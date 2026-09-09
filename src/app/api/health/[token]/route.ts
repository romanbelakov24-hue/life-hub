import { db } from "@/lib/db/client";
import { HEALTH_TOKEN_KEY, findUserIdByToken } from "@/lib/queries/settings";
import { isValidIso, todayIso } from "@/lib/utils/date";

/**
 * Приём показателей здоровья: `POST /api/health/<токен>`
 *
 * Ни у Apple Health, ни у Xiaomi Health нет веб-API — сайт не может прочитать
 * их данные напрямую ни при каких настройках. Мост здесь — автоматизация
 * «Быстрых команд» на телефоне: она сама читает Здоровье и раз в день
 * отправляет сюда то, что нашла. Настройка — на странице /health.
 *
 * Метод именно POST, а не GET, как у календаря: сюда пишут данные, а не читают
 * их, и координаты токена в URL, а тело запроса — JSON с показателями.
 *
 * Защита та же, что у календарной ленты и сводки: непредсказуемый токен,
 * сравнение за постоянное время, 404 вместо 401/403 при несовпадении — ответ
 * не должен подтверждать, что адрес вообще существует.
 */

export const dynamic = "force-dynamic";

/**
 * Принимаемые поля. Каждое необязательно — шорткат шлёт то, что у него есть.
 *
 * screenTimeMinutes сюда тоже принимается, хотя на странице /health об этом
 * не написано ни слова: у Apple нет действия Shortcuts, которое читало бы
 * Экранное время (в отличие от Здоровья, это отдельный API), так что
 * обещать автоматический сбор было бы нечестно — вместо этого поле
 * заполняется вручную через actions/health.ts. Поле в вебхуке оставлено на
 * случай, если владелец сам найдёт способ прислать его автоматически.
 */
interface HealthPayload {
  date?: unknown;
  steps?: unknown;
  sleepMinutes?: unknown;
  restingHeartRate?: unknown;
  screenTimeMinutes?: unknown;
}

/**
 * Число из JSON, разумно ограниченное сверху.
 *
 * Диапазон не для красоты: одно устройство может слать шаги (сотни тысяч —
 * потолок), другое сон в минутах (максимум сутки с запасом), третье пульс
 * покоя (у человека не бывает трёхзначных тысяч). Если automations пришлёт
 * мусор — строка лучше молчаливой записи абсурдного числа.
 */
function parseMetric(value: unknown, max: number): number | null {
  if (value === null || value === undefined) return null;

  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num) || num < 0 || num > max) return null;

  return Math.round(num);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  // 404, а не 401: неверный токен не должен подтверждать, что адрес существует.
  const userId = await findUserIdByToken(HEALTH_TOKEN_KEY, token);
  if (!userId) {
    return new Response("Not found", { status: 404 });
  }

  let payload: HealthPayload;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "Тело запроса должно быть JSON." }, { status: 400 });
  }

  // Дата не обязательна: типичный сценарий — автоматизация запускается в конце
  // дня и шлёт данные за сегодня без явной даты.
  const date =
    typeof payload.date === "string" && isValidIso(payload.date) ? payload.date : todayIso();

  const steps = parseMetric(payload.steps, 200_000);
  const sleepMinutes = parseMetric(payload.sleepMinutes, 24 * 60);
  const restingHeartRate = parseMetric(payload.restingHeartRate, 300);
  const screenTimeMinutes = parseMetric(payload.screenTimeMinutes, 24 * 60);

  if (steps === null && sleepMinutes === null && restingHeartRate === null && screenTimeMinutes === null) {
    return Response.json(
      { error: "Ни одно значение не распознано. Проверьте типы полей в теле запроса." },
      { status: 400 },
    );
  }

  const client = await db();

  // COALESCE(excluded.x, health_daily.x): пришедшее значение перезаписывает
  // старое, отсутствующее — не трогает. Так одна автоматизация про шаги не
  // затирает сон, записанный другой автоматизацией часом раньше.
  await client.execute({
    sql: `INSERT INTO health_daily
            (user_id, date, steps, sleep_minutes, resting_heart_rate, screen_time_minutes, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(user_id, date) DO UPDATE SET
            steps                = COALESCE(excluded.steps, health_daily.steps),
            sleep_minutes        = COALESCE(excluded.sleep_minutes, health_daily.sleep_minutes),
            resting_heart_rate   = COALESCE(excluded.resting_heart_rate, health_daily.resting_heart_rate),
            screen_time_minutes  = COALESCE(excluded.screen_time_minutes, health_daily.screen_time_minutes),
            updated_at           = excluded.updated_at`,
    args: [userId, date, steps, sleepMinutes, restingHeartRate, screenTimeMinutes, new Date().toISOString()],
  });

  return Response.json({ ok: true, date, steps, sleepMinutes, restingHeartRate, screenTimeMinutes });
}
