import { revalidatePath } from "next/cache";

import {
  AGENT_API_VERSION,
  isPriority,
  priorityToFlags,
  serializeEvent,
  serializeExpense,
  serializeNote,
  serializeTask,
} from "@/lib/agent/contract";
import { PALETTE } from "@/config/palette";
import { insertEvents, validateEvent, type EventInput } from "@/lib/mutations/events";
import { insertExpense, validateExpense } from "@/lib/mutations/expenses";
import {
  insertNote,
  insertTask,
  setTaskDone,
  updateTaskFields,
  validateNote,
  validateTask,
  type NoteInput,
  type TaskInput,
} from "@/lib/mutations/study";
import { listEventsInRange } from "@/lib/queries/events";
import { listCategories, listExpensesInRange } from "@/lib/queries/expenses";
import { findUserIdByAgentToken } from "@/lib/queries/settings";
import {
  findTask,
  getTaskCounters,
  listNotes,
  listRecentNotes,
  listTasksFiltered,
} from "@/lib/queries/study";
import { findUserById } from "@/lib/queries/users";
import { addDays, endOfMonth, isValidIso, startOfMonth, todayIso } from "@/lib/utils/date";
import { roundTo } from "@/lib/utils/format";

/**
 * API агента KAIROS: `/api/agent/<раздел>[/<id>]`.
 *
 * Зачем отдельный маршрут: интерфейс life hub пишет данные через Server Actions,
 * а они внешнему клиенту не годятся — их идентификаторы меняются с каждым
 * деплоем, а доступ идёт по сессионной куке. Здесь обычный REST с токеном.
 *
 * Доступ — `Authorization: Bearer <токен>`. Токен выпускается в Настройках и
 * определяет пользователя: все чтения и записи идут только в его данные, id
 * пользователя в запросе агент не передаёт и подменить не может.
 *
 * Сознательные ограничения (решение владельца, 15.09.2026):
 *  - никаких удалений — необратимое агенту не доверяется;
 *  - данных «Здоровья» в API нет вовсе: самые чувствительные, агенту не нужны
 *    (путь /health — только проверка связи, а не этот раздел);
 *  - запись только в задачи, траты, календарь и заметки.
 *
 * Запись идёт через lib/mutations/* — ту же валидацию, что у форм интерфейса,
 * так что через агента нельзя записать то, чего не пропустила бы форма.
 */

export const dynamic = "force-dynamic";

const SECTIONS = ["tasks", "expenses", "schedule", "notes"] as const;
type Section = (typeof SECTIONS)[number];

const MAX_LIMIT = 200;

// ─── Ответы ──────────────────────────────────────────────────────────────────

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

function fail(status: number, error: string, extra: Record<string, unknown> = {}): Response {
  return json({ ok: false, error, ...extra }, status);
}

/** Ошибка во входных данных — отдаётся агенту как 400 с понятным текстом. */
class BadRequest extends Error {}

// ─── Разбор входа ────────────────────────────────────────────────────────────

type Body = Record<string, unknown>;

async function readBody(request: Request): Promise<Body> {
  let parsed: unknown;
  try {
    parsed = await request.json();
  } catch {
    throw new BadRequest("Тело запроса должно быть JSON-объектом.");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new BadRequest("Тело запроса должно быть JSON-объектом.");
  }
  return parsed as Body;
}

/** Строка из тела; отсутствующее и null — undefined, не-строка — ошибка. */
function optionalString(body: Body, key: string): string | undefined {
  const value = body[key];
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") throw new BadRequest(`Поле «${key}» должно быть строкой.`);
  return value;
}

function queryDate(url: URL, key: string): string | undefined {
  const value = url.searchParams.get(key);
  if (value === null || value === "") return undefined;
  if (!isValidIso(value)) throw new BadRequest(`Параметр «${key}» — дата в формате ГГГГ-ММ-ДД.`);
  return value;
}

function queryLimit(url: URL, fallback: number): number {
  const raw = url.searchParams.get("limit");
  if (raw === null) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1) throw new BadRequest("Параметр «limit» — целое число от 1.");
  return Math.min(value, MAX_LIMIT);
}

// ─── Задачи ──────────────────────────────────────────────────────────────────

async function listTasksHandler(userId: string, url: URL): Promise<Response> {
  const status = url.searchParams.get("status") ?? "open";
  if (status !== "open" && status !== "done" && status !== "all") {
    throw new BadRequest("Параметр «status»: open, done или all.");
  }

  const tasks = await listTasksFiltered(userId, {
    status,
    from: queryDate(url, "from"),
    to: queryDate(url, "to"),
    limit: queryLimit(url, 100),
  });

  const items = tasks.map(serializeTask);
  return json({ ok: true, section: "tasks", count: items.length, items });
}

/**
 * Создание задачи. Тело — как шлёт сценарий захвата KAIROS:
 * `{ title, due?, priority?, note?, subject? }`. Без приоритета — P2, как и
 * у формы, где новая задача по умолчанию важная, но не срочная.
 */
async function createTaskHandler(userId: string, request: Request): Promise<Response> {
  const body = await readBody(request);

  const priority = body.priority ?? "P2";
  if (!isPriority(priority)) throw new BadRequest("Поле «priority»: P1, P2 или P3.");

  const input: TaskInput = {
    title: optionalString(body, "title") ?? "",
    description: optionalString(body, "note") ?? "",
    dueDate: optionalString(body, "due") ?? "",
    subject: optionalString(body, "subject") ?? "",
    ...priorityToFlags(priority),
  };

  const error = validateTask(input);
  if (error) throw new BadRequest(error);

  const id = await insertTask(userId, input);
  const task = await findTask(userId, id);

  revalidateStudy();
  return json({ ok: true, section: "tasks", item: task ? serializeTask(task) : { id } }, 201);
}

/**
 * Частичное обновление: меняются только переданные поля. `due: null` снимает
 * срок. `done` отмечает выполнение и ставит время выполнения — так же, как
 * галочка в интерфейсе.
 */
async function updateTaskHandler(userId: string, id: string, request: Request): Promise<Response> {
  const body = await readBody(request);

  const current = await findTask(userId, id);
  if (!current) return fail(404, "Задача не найдена.");

  if (body.priority !== undefined && !isPriority(body.priority)) {
    throw new BadRequest("Поле «priority»: P1, P2 или P3.");
  }
  if (body.done !== undefined && typeof body.done !== "boolean") {
    throw new BadRequest("Поле «done» должно быть true или false.");
  }

  const flags = isPriority(body.priority)
    ? priorityToFlags(body.priority)
    : { urgent: current.urgent, important: current.important };

  const next: TaskInput = {
    title: optionalString(body, "title") ?? current.title,
    description: "note" in body ? (optionalString(body, "note") ?? "") : current.description,
    dueDate: "due" in body ? (optionalString(body, "due") ?? "") : current.dueDate,
    subject: "subject" in body ? (optionalString(body, "subject") ?? "") : current.subject,
    ...flags,
  };

  const error = validateTask(next);
  if (error) throw new BadRequest(error);

  await updateTaskFields(userId, id, next);
  if (typeof body.done === "boolean" && body.done !== current.done) {
    await setTaskDone(userId, id, body.done);
  }

  const updated = await findTask(userId, id);
  revalidateStudy();
  return json({ ok: true, section: "tasks", item: updated ? serializeTask(updated) : { id } });
}

// ─── Траты ───────────────────────────────────────────────────────────────────

async function listExpensesHandler(userId: string, url: URL): Promise<Response> {
  const today = todayIso();
  const to = queryDate(url, "to") ?? today;
  const from = queryDate(url, "from") ?? addDays(to, -30);
  const category = url.searchParams.get("category")?.trim().toLowerCase();

  let expenses = await listExpensesInRange(userId, from, to);
  if (category) expenses = expenses.filter((e) => e.categoryName.toLowerCase() === category);

  const items = expenses.slice(0, queryLimit(url, 100)).map(serializeExpense);
  return json({ ok: true, section: "expenses", from, to, count: items.length, items });
}

/**
 * Трата. Категорию агент называет словами («Еда»), а не id: он не знает id и
 * не должен их хранить. Не нашлась — трата уходит в «Другое», а в ответе
 * `categoryMatched: false`, чтобы агент мог переспросить или сказать об этом.
 */
async function createExpenseHandler(userId: string, request: Request): Promise<Response> {
  const body = await readBody(request);

  const amount = typeof body.amount === "string" ? Number(body.amount) : body.amount;
  if (typeof amount !== "number") throw new BadRequest("Поле «amount» — число.");

  const categories = await listCategories(userId);
  const wanted = optionalString(body, "category")?.trim().toLowerCase();
  const matched = wanted ? categories.find((c) => c.name.toLowerCase() === wanted) : undefined;
  const fallback = categories.find((c) => c.name === "Другое") ?? categories[categories.length - 1];
  const category = matched ?? fallback;
  if (!category) return fail(409, "У пользователя нет ни одной категории трат.");

  const input = {
    date: optionalString(body, "date") ?? todayIso(),
    categoryId: category.id,
    note: optionalString(body, "note") ?? "",
    amount,
  };

  const error = validateExpense(input);
  if (error) throw new BadRequest(error);

  const id = await insertExpense(userId, input);
  if (!id) return fail(409, "Категория не найдена.");

  revalidatePath("/expenses");
  revalidatePath("/");
  return json(
    {
      ok: true,
      section: "expenses",
      categoryMatched: Boolean(matched),
      item: {
        id,
        date: input.date,
        amount: roundTo(amount, 2),
        category: category.name,
        categoryId: category.id,
        note: input.note.trim() || null,
      },
    },
    201,
  );
}

// ─── Календарь ───────────────────────────────────────────────────────────────

async function listScheduleHandler(userId: string, url: URL): Promise<Response> {
  const from = queryDate(url, "from") ?? todayIso();
  const to = queryDate(url, "to") ?? addDays(from, 7);
  if (to < from) throw new BadRequest("«to» раньше «from».");

  const items = (await listEventsInRange(userId, from, to)).map(serializeEvent);
  return json({ ok: true, section: "schedule", from, to, count: items.length, items });
}

/** Дело в календаре. Серий агент не создаёт — повтор остаётся ручным действием. */
async function createScheduleHandler(userId: string, request: Request): Promise<Response> {
  const body = await readBody(request);

  const input: EventInput = {
    title: optionalString(body, "title") ?? "",
    date: optionalString(body, "date") ?? "",
    startTime: optionalString(body, "start") ?? "",
    endTime: optionalString(body, "end") ?? "",
    location: optionalString(body, "location") ?? "",
    description: optionalString(body, "description") ?? "",
    color: PALETTE[0]?.value ?? "#7e8894",
  };

  // Начало без конца — как и в форме: половина времени ничего не значит.
  if ((input.startTime === "") !== (input.endTime === "")) {
    throw new BadRequest("Укажите и «start», и «end», либо ни одного (дело на весь день).");
  }

  const error = validateEvent(input);
  if (error) throw new BadRequest(error);

  const id = await insertEvents(userId, input);

  revalidatePath("/schedule");
  revalidatePath("/");
  return json(
    {
      ok: true,
      section: "schedule",
      item: {
        id,
        date: input.date,
        start: input.startTime || null,
        end: input.endTime || null,
        title: input.title.trim(),
        location: input.location.trim() || null,
        description: input.description.trim() || null,
      },
    },
    201,
  );
}

// ─── Заметки ─────────────────────────────────────────────────────────────────

async function listNotesHandler(userId: string, url: URL): Promise<Response> {
  const subject = url.searchParams.get("subject")?.trim();
  const limit = queryLimit(url, 20);
  const notes = subject ? (await listNotes(userId, subject)).slice(0, limit) : await listRecentNotes(userId, limit);

  const items = notes.map(serializeNote);
  return json({ ok: true, section: "notes", count: items.length, items });
}

async function createNoteHandler(userId: string, request: Request): Promise<Response> {
  const body = await readBody(request);

  const input: NoteInput = {
    title: optionalString(body, "title") ?? "",
    body: optionalString(body, "body") ?? "",
    date: optionalString(body, "date") ?? todayIso(),
    subject: optionalString(body, "subject") ?? "",
  };

  const error = validateNote(input);
  if (error) throw new BadRequest(error);

  const id = await insertNote(userId, input);

  revalidateStudy();
  return json(
    {
      ok: true,
      section: "notes",
      item: {
        id,
        title: input.title.trim() || null,
        body: input.body.trim(),
        date: input.date,
        subject: input.subject.trim() || null,
      },
    },
    201,
  );
}

// ─── Сводка дня ──────────────────────────────────────────────────────────────

/**
 * Всё для утреннего брифинга одним запросом: горящие задачи (включая
 * просроченные), дела на день, траты месяца. Раздел, который упал, не роняет
 * сводку целиком — брифинг лучше неполный, чем никакой.
 */
async function summaryHandler(userId: string, url: URL): Promise<Response> {
  const date = queryDate(url, "date") ?? todayIso();
  const summary: Record<string, unknown> = { ok: true, date };

  const section = async (name: string, load: () => Promise<unknown>) => {
    try {
      summary[name] = await load();
    } catch (error) {
      console.error(`[agent] summary.${name}`, error);
      summary[name] = { error: "Не удалось загрузить раздел." };
    }
  };

  await Promise.all([
    section("tasksDue", async () =>
      (await listTasksFiltered(userId, { status: "open", to: date, limit: 50 })).map(serializeTask),
    ),
    section("taskCounters", () => getTaskCounters(userId, date)),
    section("schedule", async () => (await listEventsInRange(userId, date, date)).map(serializeEvent)),
    section("expensesMonth", async () => {
      const expenses = await listExpensesInRange(userId, startOfMonth(date), endOfMonth(date));
      const total = roundTo(expenses.reduce((sum, e) => sum + e.amount, 0), 2);
      return { month: date.slice(0, 7), total, count: expenses.length };
    }),
  ]);

  return json(summary);
}

// ─── Маршрутизация ───────────────────────────────────────────────────────────

function revalidateStudy(): void {
  revalidatePath("/tasks");
  revalidatePath("/notes");
  revalidatePath("/");
}

async function authenticate(request: Request): Promise<string | Response> {
  const header = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(\S+)$/i.exec(header.trim());
  if (!match?.[1]) return fail(401, "Нужен заголовок Authorization: Bearer <токен>.");

  const userId = await findUserIdByAgentToken(match[1]);
  // Один ответ и для неизвестного, и для отозванного токена: разница подсказала
  // бы, что токен когда-то существовал.
  return userId ?? fail(401, "Токен не принят.");
}

async function handle(
  request: Request,
  { params }: { params: Promise<{ path?: string[] }> },
): Promise<Response> {
  try {
    const auth = await authenticate(request);
    if (auth instanceof Response) return auth;
    const userId = auth;

    const { path = [] } = await params;
    const [section, id, ...rest] = path;
    const method = request.method.toUpperCase();
    const url = new URL(request.url);

    if (rest.length > 0) return fail(404, "Неизвестный путь.");

    if (!section || section === "health") {
      if (method !== "GET") return fail(405, "Только GET.");
      const user = await findUserById(userId);
      return json({
        ok: true,
        version: AGENT_API_VERSION,
        user: { id: userId, name: user?.name || null },
        sections: SECTIONS,
      });
    }

    if (section === "summary") {
      return method === "GET" ? await summaryHandler(userId, url) : fail(405, "Только GET.");
    }

    // Данных здоровья среди разделов нет вовсе: закрыты не проверкой, а тем, что
    // для них нет ни одного обработчика. /health выше — только проверка связи.
    if (!(SECTIONS as readonly string[]).includes(section)) {
      return fail(404, `Неизвестный раздел «${section}».`, { sections: SECTIONS });
    }

    if (method === "DELETE") return fail(405, "Удаление через API агента не поддерживается.");

    const name = section as Section;

    if (id !== undefined) {
      if (name === "tasks" && method === "PATCH") return await updateTaskHandler(userId, id, request);
      return fail(405, `${method} /${name}/<id> не поддерживается.`);
    }

    if (method === "GET") {
      if (name === "tasks") return await listTasksHandler(userId, url);
      if (name === "expenses") return await listExpensesHandler(userId, url);
      if (name === "schedule") return await listScheduleHandler(userId, url);
      return await listNotesHandler(userId, url);
    }

    if (method === "POST") {
      if (name === "tasks") return await createTaskHandler(userId, request);
      if (name === "expenses") return await createExpenseHandler(userId, request);
      if (name === "schedule") return await createScheduleHandler(userId, request);
      return await createNoteHandler(userId, request);
    }

    return fail(405, `Метод ${method} не поддерживается.`);
  } catch (error) {
    if (error instanceof BadRequest) return fail(400, error.message);
    console.error("[agent]", error);
    return fail(500, "Внутренняя ошибка. Подробности — в логах life hub.");
  }
}

export const GET = handle;
export const POST = handle;
export const PATCH = handle;
export const PUT = handle;
export const DELETE = handle;
