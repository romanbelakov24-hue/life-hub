/**
 * Подключение общего Telegram-бота к сайту: `npm run telegram:setup`.
 *
 * Регистрирует вебхук (Telegram начнёт слать сообщения на
 * <сайт>/api/telegram/webhook с секретным заголовком), список команд и описание
 * бота. Запускать после деплоя сайта с секретом TELEGRAM_BOT_TOKEN и каждый
 * раз, когда меняется адрес сайта. Повторный запуск безопасен.
 *
 * Токен берётся из .env.prod.local (TELEGRAM_BOT_TOKEN=…). Адрес сайта — первым
 * аргументом или SITE_URL, по умолчанию https://life-hub.aarara.workers.dev.
 *
 * ⚠ С вебхуком бот больше не отдаёт сообщения через getUpdates — программа,
 * которая раньше читала этого бота так (KAIROS), получит ошибку 409. Её нужно
 * заранее перевести на другого бота.
 */

import { DEFAULT_BOT_USERNAME } from "../src/lib/telegram/config";
import { webhookSecret } from "../src/lib/telegram/secrets";
import { loadEnvFile } from "./lib/env";

loadEnvFile(".env.prod.local");
loadEnvFile(".env.local");

const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
const site = (process.argv[2] || process.env.SITE_URL || "https://life-hub.aarara.workers.dev").replace(/\/+$/, "");

async function call<T>(method: string, payload: Record<string, unknown> = {}): Promise<T> {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = (await response.json()) as { ok: boolean; result?: T; description?: string };
  if (!data.ok) throw new Error(`${method}: ${data.description ?? response.status}`);
  return data.result as T;
}

async function main(): Promise<void> {
  if (!token) {
    throw new Error("Нет TELEGRAM_BOT_TOKEN. Добавь строку TELEGRAM_BOT_TOKEN=… в .env.prod.local.");
  }

  const me = await call<{ username: string }>("getMe");
  console.log(`Бот: @${me.username}`);
  if (me.username !== DEFAULT_BOT_USERNAME) {
    console.warn(
      `⚠ Имя бота отличается от ${DEFAULT_BOT_USERNAME} — поправь TELEGRAM_BOT_USERNAME в wrangler.jsonc (vars).`,
    );
  }

  await call("setWebhook", {
    url: `${site}/api/telegram/webhook`,
    secret_token: await webhookSecret(token),
    allowed_updates: ["message", "callback_query"],
    // Сообщения, скопившиеся, пока бота читал кто-то другой, сайту не нужны.
    drop_pending_updates: true,
    max_connections: 10,
  });
  console.log(`Вебхук: ${site}/api/telegram/webhook`);

  await call("setMyCommands", {
    commands: [
      { command: "today", description: "Сводка на сегодня" },
      { command: "task", description: "Записать задачу" },
      { command: "event", description: "Записать дело в календарь" },
      { command: "expense", description: "Записать трату" },
      { command: "note", description: "Записать заметку" },
      { command: "help", description: "Что умеет бот" },
      { command: "unlink", description: "Отвязать этот чат" },
    ],
  });
  await call("setMyDescription", {
    description:
      "Записываю задачи, дела в календарь, траты и заметки в life hub — текстом или голосом. " +
      "По утрам присылаю сводку дня. Чтобы начать, привяжи аккаунт в настройках life hub.",
  });
  await call("setMyShortDescription", {
    short_description: "Задачи, дела, траты и заметки в life hub — текстом или голосом.",
  });
  console.log("Команды и описание обновлены.");

  const info = await call<{ url: string; pending_update_count: number; last_error_message?: string }>(
    "getWebhookInfo",
  );
  console.log(`Проверка: вебхук ${info.url ? "установлен" : "НЕ установлен"}, в очереди ${info.pending_update_count}.`);
  if (info.last_error_message) console.warn(`Последняя ошибка доставки: ${info.last_error_message}`);
}

main().catch((error) => {
  // Токен живёт в адресе запроса — в сообщение об ошибке он не попадает: здесь
  // только имя метода и ответ Telegram.
  console.error("Не удалось настроить бота:", error instanceof Error ? error.message : error);
  process.exit(1);
});
