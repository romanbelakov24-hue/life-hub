/**
 * Производные секреты бота. Без "server-only" и без алиасов путей: модуль
 * импортируют и сайт, и custom-worker.ts (обработчик расписания воркера), и
 * scripts/telegram-setup.ts.
 *
 * Отдельных переменных под секрет вебхука и секрет крона нет — оба выводятся
 * из токена бота. Токен и так главный секрет: у кого он есть, тот управляет
 * ботом целиком, так что производный от него секрет ничего не ослабляет, а
 * настраивать на одну переменную меньше. Разные префиксы — чтобы один секрет
 * нельзя было подставить вместо другого.
 */

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** Значение заголовка X-Telegram-Bot-Api-Secret-Token, которое Telegram шлёт с каждым обновлением. */
export function webhookSecret(botToken: string): Promise<string> {
  return sha256Hex(`life-hub:telegram-webhook:${botToken}`);
}

/** Секрет, которым обработчик расписания воркера подписывает вызов /api/cron/digest. */
export function cronSecret(botToken: string): Promise<string> {
  return sha256Hex(`life-hub:cron:${botToken}`);
}
