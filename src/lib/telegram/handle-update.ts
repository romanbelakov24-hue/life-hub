import "server-only";

import { revalidatePath } from "next/cache";

import { PALETTE } from "@/config/palette";
import { insertEvents, validateEvent } from "@/lib/mutations/events";
import { insertExpense, validateExpense } from "@/lib/mutations/expenses";
import { insertNote, insertTask, validateNote, validateTask } from "@/lib/mutations/study";
import { listCategories } from "@/lib/queries/expenses";
import { findUserById } from "@/lib/queries/users";
import type { Category } from "@/lib/types";
import { guessCategoryId } from "@/lib/utils/quick-parse";

import { getAi, transcribe, understand } from "./ai";
import { answerCallback, downloadFile, editMessage, sendChatAction, sendMessage } from "./api";
import { AI_MESSAGES_PER_DAY, MAX_VOICE_SECONDS, siteUrl } from "./config";
import { zonedNow } from "./dates";
import { sendDigestNow } from "./digest";
import { escapeHtml, formatHelp, formatLinked, formatSaved, formatWelcome, intentSummary } from "./format";
import type { BotIntent, IntentKind } from "./intent";
import {
  claimUpdate,
  completeUpdate,
  consumeLinkCode,
  countAiUsesLastDay,
  findLinkByChat,
  linkChat,
  undoBotEvent,
  unlinkUser,
  type BotInputKind,
  type RecordKind,
  type TelegramLink,
} from "./store";
import type { TgCallbackQuery, TgMessage, TgUpdate } from "./types";

/**
 * Обработка одного обновления Telegram: сообщение, голосовое или кнопка.
 *
 * Пишет в данные ТОЛЬКО того аккаунта, к которому привязан чат, и только через
 * lib/mutations — с той же проверкой, что у форм сайта. Работает лишь в личных
 * чатах: в группе «кто пишет» и «чей аккаунт» расходятся.
 */

const FORCED_COMMANDS: Record<string, IntentKind> = {
  "/task": "task",
  "/event": "event",
  "/expense": "expense",
  "/note": "note",
};

const PAGE_OF: Record<RecordKind, string> = {
  task: "/tasks",
  event: "/schedule",
  expense: "/expenses",
  note: "/notes",
};

function openButton(path = "/") {
  return [{ text: "Открыть в life hub ↗", url: `${siteUrl()}${path}` }];
}

function commandOf(text: string): { command: string; rest: string } | null {
  const match = /^(\/[a-z_]+)(?:@\w+)?(?:\s+([\s\S]*))?$/i.exec(text.trim());
  return match ? { command: match[1]!.toLowerCase(), rest: (match[2] ?? "").trim() } : null;
}

function inputKindOf(message: TgMessage): BotInputKind {
  if (message.voice || message.audio) return "voice";
  if (message.text?.startsWith("/")) return "command";
  return message.text ? "text" : "other";
}

export async function handleUpdate(update: TgUpdate): Promise<void> {
  if (update.callback_query) return handleCallback(update.update_id, update.callback_query);

  const message = update.message;
  if (!message || message.chat.type !== "private" || message.from?.is_bot) return;

  const chatId = String(message.chat.id);
  const link = await findLinkByChat(chatId);
  if (!(await claimUpdate(update.update_id, link?.userId ?? null, inputKindOf(message)))) return;

  const text = message.text?.trim() ?? "";
  const command = commandOf(text);

  if (command?.command === "/start") {
    if (command.rest) return linkByCode(chatId, message, command.rest);
    if (link) return void (await sendMessage(chatId, formatHelp(link.digestEnabled ? link.digestTime : null)));
    return sendNotLinked(chatId);
  }

  if (!link) return sendNotLinked(chatId);

  if (command) {
    const forced = FORCED_COMMANDS[command.command];
    if (forced) {
      if (!command.rest) {
        await sendMessage(chatId, "Напиши текст сразу после команды, например: <i>/task купить подарок маме</i>");
        return;
      }
      return processText(update.update_id, link, message, command.rest, { forcedKind: forced });
    }
    if (command.command === "/help") {
      await sendMessage(chatId, formatHelp(link.digestEnabled ? link.digestTime : null));
      return;
    }
    if (command.command === "/today") {
      await sendChatAction(chatId);
      await sendDigestNow(link);
      return;
    }
    if (command.command === "/unlink" || command.command === "/stop") {
      await unlinkUser(link.userId);
      revalidatePath("/settings");
      await sendMessage(
        chatId,
        "Чат отвязан — больше ничего не запишу и не пришлю. Привязать снова можно в настройках life hub.",
        { keyboard: [openButton("/settings")] },
      );
      return;
    }
    await sendMessage(chatId, "Не знаю такой команды. /help — что я умею.");
    return;
  }

  const voice = message.voice ?? message.audio;
  if (voice) return processVoice(update.update_id, link, message, voice.file_id, voice.duration);
  if (text) return processText(update.update_id, link, message, text, {});

  await sendMessage(chatId, "Пока понимаю только текст и голосовые 🙂");
}

// ─── Привязка ────────────────────────────────────────────────────────────────

async function sendNotLinked(chatId: string): Promise<void> {
  await sendMessage(chatId, formatWelcome(siteUrl()), {
    keyboard: [
      [{ text: "Подключить в настройках ↗", url: `${siteUrl()}/settings#telegram` }],
      [{ text: "Создать аккаунт ↗", url: `${siteUrl()}/register` }],
    ],
  });
}

async function linkByCode(chatId: string, message: TgMessage, code: string): Promise<void> {
  const claimed = await consumeLinkCode(code);
  if (!claimed) {
    await sendMessage(
      chatId,
      "Ссылка устарела или уже использована. Открой настройки life hub и нажми «Подключить Telegram» ещё раз.",
      { keyboard: [openButton("/settings#telegram")] },
    );
    return;
  }

  await linkChat(
    claimed.userId,
    {
      chatId,
      username: message.from?.username ?? "",
      firstName: message.from?.first_name ?? "",
    },
    claimed.timezone,
  );
  revalidatePath("/settings");

  const user = await findUserById(claimed.userId);
  const linked = await findLinkByChat(chatId);
  await sendMessage(chatId, formatLinked(user?.name || user?.email || "life hub", linked?.digestTime ?? "08:00"));
}

// ─── Голосовые и текст ───────────────────────────────────────────────────────

async function processVoice(
  updateId: number,
  link: TelegramLink,
  message: TgMessage,
  fileId: string,
  duration: number,
): Promise<void> {
  const chatId = link.chatId;
  if (duration > MAX_VOICE_SECONDS) {
    await sendMessage(chatId, `Голосовые до ${MAX_VOICE_SECONDS / 60} минут — разбей мысль на пару сообщений.`);
    return completeUpdate(updateId, { usedAi: false, resultKind: "none" });
  }

  const ai = (await countAiUsesLastDay(link.userId)) < AI_MESSAGES_PER_DAY ? await getAi() : null;
  if (!ai) {
    await sendMessage(chatId, "Голосовые сейчас не расшифровываются — напиши, пожалуйста, текстом.");
    return completeUpdate(updateId, { usedAi: false, resultKind: "none" });
  }

  await sendChatAction(chatId, "typing");
  let transcript = "";
  try {
    transcript = await transcribe(ai, await downloadFile(fileId));
  } catch (error) {
    console.error("[bot] voice", error instanceof Error ? error.message : error);
    await sendMessage(chatId, "Не получилось расшифровать голосовое. Попробуй ещё раз или напиши текстом.");
    return completeUpdate(updateId, { usedAi: true, resultKind: "error" });
  }

  if (!transcript) {
    await sendMessage(chatId, "Не расслышал ни слова 🙉 Попробуй ещё раз.");
    return completeUpdate(updateId, { usedAi: true, resultKind: "none" });
  }

  return processText(updateId, link, message, transcript, { transcript, ai });
}

async function processText(
  updateId: number,
  link: TelegramLink,
  message: TgMessage,
  text: string,
  options: {
    forcedKind?: IntentKind;
    transcript?: string;
    ai?: Awaited<ReturnType<typeof getAi>>;
  },
): Promise<void> {
  const chatId = link.chatId;
  await sendChatAction(chatId);

  const now = zonedNow(link.timezone);
  const categories = await listCategories(link.userId);
  const underLimit = (await countAiUsesLastDay(link.userId)) < AI_MESSAGES_PER_DAY;
  const ai = options.ai ?? (underLimit ? await getAi() : null);

  const { intent, usedAi } = await understand(text, {
    today: now.date,
    now: now.time,
    timeZone: link.timezone,
    categories: categories.map((category) => category.name),
    forcedKind: options.forcedKind,
    originalText: text,
  }, ai);
  const spentAi = usedAi || Boolean(options.transcript);

  if (intent.kind === "unknown") {
    await sendMessage(chatId, escapeHtml(intent.reply), { replyTo: message.message_id });
    return completeUpdate(updateId, { usedAi: spentAi, resultKind: "none" });
  }

  const saved = await save(link.userId, intent, categories, now.date);
  if ("error" in saved) {
    await sendMessage(chatId, `Не записал: ${escapeHtml(saved.error)}`, { replyTo: message.message_id });
    return completeUpdate(updateId, { usedAi: spentAi, resultKind: "error" });
  }

  revalidatePath(PAGE_OF[intent.kind]);
  revalidatePath("/");

  const footnote =
    !usedAi && !underLimit
      ? "ИИ на сегодня исчерпан — разобрал по шаблону. Если не то, нажми «Отменить»."
      : undefined;
  await sendMessage(
    chatId,
    formatSaved(intent, now.date, { categoryName: saved.categoryName, transcript: options.transcript, footnote }),
    {
      replyTo: message.message_id,
      keyboard: [
        [{ text: "↩️ Отменить", callback_data: `undo:${updateId}` }],
        openButton(PAGE_OF[intent.kind]),
      ],
    },
  );

  await completeUpdate(updateId, {
    usedAi: spentAi,
    resultKind: intent.kind,
    resultId: saved.id,
    summary: intentSummary(intent, saved.categoryName),
  });
}

function resolveCategory(intent: Extract<BotIntent, { kind: "expense" }>, categories: Category[]): Category | null {
  const wanted = intent.category.trim().toLowerCase();
  const byName = wanted ? categories.find((category) => category.name.toLowerCase() === wanted) : undefined;
  if (byName) return byName;

  const guessedId = intent.note ? guessCategoryId(intent.note, categories) : null;
  const guessed = guessedId ? categories.find((category) => category.id === guessedId) : undefined;
  return guessed ?? categories.find((category) => category.name === "Другое") ?? categories.at(-1) ?? null;
}

async function save(
  userId: string,
  intent: Exclude<BotIntent, { kind: "unknown" }>,
  categories: Category[],
  today: string,
): Promise<{ id: string; categoryName?: string } | { error: string }> {
  if (intent.kind === "task") {
    const input = {
      title: intent.title,
      description: intent.description,
      dueDate: intent.dueDate,
      urgent: intent.urgent,
      important: intent.important,
      subject: "",
    };
    const error = validateTask(input);
    return error ? { error } : { id: await insertTask(userId, input, "telegram") };
  }

  if (intent.kind === "event") {
    const input = {
      date: intent.date,
      startTime: intent.startTime,
      endTime: intent.endTime,
      title: intent.title,
      location: intent.location,
      description: intent.description,
      color: PALETTE[0]?.value ?? "#7e8894",
    };
    const error = validateEvent(input);
    return error ? { error } : { id: await insertEvents(userId, input, "telegram") };
  }

  if (intent.kind === "expense") {
    const category = resolveCategory(intent, categories);
    if (!category) return { error: "в аккаунте нет ни одной категории трат." };
    const input = { date: intent.date, categoryId: category.id, note: intent.note, amount: intent.amount };
    const error = validateExpense(input);
    if (error) return { error };
    const id = await insertExpense(userId, input, "telegram");
    return id ? { id, categoryName: category.name } : { error: "категория не найдена." };
  }

  const input = { title: intent.title, body: intent.body, date: today, subject: "" };
  const error = validateNote(input);
  return error ? { error } : { id: await insertNote(userId, input, "telegram") };
}

// ─── Кнопки ──────────────────────────────────────────────────────────────────

async function handleCallback(updateId: number, query: TgCallbackQuery): Promise<void> {
  const chatId = query.message?.chat.id !== undefined ? String(query.message.chat.id) : null;
  const link = chatId ? await findLinkByChat(chatId) : null;
  // Кнопку нажимает тот же человек, чей это личный чат, — иначе не наша кнопка.
  if (!link || !query.message || String(query.from.id) !== link.chatId) {
    await answerCallback(query.id).catch(() => undefined);
    return;
  }
  if (!(await claimUpdate(updateId, link.userId, "callback"))) return;

  const undoMatch = /^undo:(\d+)$/.exec(query.data ?? "");
  if (!undoMatch) {
    await answerCallback(query.id).catch(() => undefined);
    return;
  }

  const undone = await undoBotEvent(link.userId, Number(undoMatch[1]));
  if (!undone) {
    await answerCallback(query.id, "Уже отменено").catch(() => undefined);
    return;
  }

  revalidatePath(PAGE_OF[undone.kind]);
  revalidatePath("/");
  await answerCallback(query.id, "Отменено").catch(() => undefined);
  await editMessage(link.chatId, query.message.message_id, `↩️ <s>${escapeHtml(undone.summary)}</s>\nОтменено.`).catch(
    () => undefined,
  );
}
