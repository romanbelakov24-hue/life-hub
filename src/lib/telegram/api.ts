import "server-only";

import { botToken, telegramApiBase } from "./config";
import type { TgInlineKeyboard, TgMessage } from "./types";

/**
 * Вызовы Telegram Bot API. Токен живёт в адресе запроса, поэтому ни адрес, ни
 * исходная ошибка fetch не попадают в текст исключений и логов — только имя
 * метода и описание ошибки от Telegram.
 */

export class TelegramError extends Error {
  constructor(
    readonly method: string,
    readonly description: string,
  ) {
    super(`Telegram ${method}: ${description}`);
  }
}

function requireToken(): string {
  const token = botToken();
  if (!token) throw new TelegramError("config", "TELEGRAM_BOT_TOKEN не задан");
  return token;
}

async function call<T>(method: string, payload: Record<string, unknown>): Promise<T> {
  const url = `${telegramApiBase()}/bot${requireToken()}/${method}`;
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new TelegramError(method, "сеть недоступна или Telegram не ответил");
  }

  const data = (await response.json().catch(() => null)) as
    | { ok: boolean; result?: T; description?: string }
    | null;
  if (!data?.ok) throw new TelegramError(method, data?.description ?? `HTTP ${response.status}`);
  return data.result as T;
}

interface SendOptions {
  keyboard?: TgInlineKeyboard;
  replyTo?: number;
}

/** Сообщения — HTML-разметка Telegram: <b>, <i>, <a>. Текст пользователя экранировать (escapeHtml). */
export function sendMessage(chatId: string, text: string, options: SendOptions = {}) {
  return call<TgMessage>("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    link_preview_options: { is_disabled: true },
    ...(options.keyboard ? { reply_markup: { inline_keyboard: options.keyboard } } : {}),
    ...(options.replyTo
      ? { reply_parameters: { message_id: options.replyTo, allow_sending_without_reply: true } }
      : {}),
  });
}

export function editMessage(
  chatId: string,
  messageId: number,
  text: string,
  keyboard: TgInlineKeyboard = [],
) {
  return call<unknown>("editMessageText", {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: "HTML",
    link_preview_options: { is_disabled: true },
    reply_markup: { inline_keyboard: keyboard },
  });
}

export function answerCallback(callbackId: string, text?: string) {
  return call<unknown>("answerCallbackQuery", { callback_query_id: callbackId, text });
}

/** «печатает…» / «записывает голосовое…» — пока идёт разбор. Ошибка не важна. */
export async function sendChatAction(chatId: string, action: "typing" | "record_voice" = "typing") {
  await call<unknown>("sendChatAction", { chat_id: chatId, action }).catch(() => undefined);
}

/** Скачивает файл (голосовое) по file_id. */
export async function downloadFile(fileId: string): Promise<ArrayBuffer> {
  const file = await call<{ file_path?: string }>("getFile", { file_id: fileId });
  if (!file.file_path) throw new TelegramError("getFile", "нет пути к файлу");

  let response: Response;
  try {
    response = await fetch(`${telegramApiBase()}/file/bot${requireToken()}/${file.file_path}`, {
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw new TelegramError("file", "не удалось скачать файл");
  }
  if (!response.ok) throw new TelegramError("file", `HTTP ${response.status}`);
  return response.arrayBuffer();
}
