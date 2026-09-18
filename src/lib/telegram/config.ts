/**
 * Настройки Telegram-бота из окружения.
 *
 *   TELEGRAM_BOT_TOKEN     — секрет воркера (npx wrangler secret put TELEGRAM_BOT_TOKEN);
 *                            без него бот выключен, остальной сайт работает.
 *   TELEGRAM_BOT_USERNAME  — имя бота для ссылок t.me (vars в wrangler.jsonc);
 *   TELEGRAM_API_BASE      — только для локальной проверки: подменяет
 *                            api.telegram.org фальшивым сервером. В проде
 *                            игнорируется, чтобы токен нельзя было увести
 *                            на чужой адрес одной переменной.
 */

export const DEFAULT_BOT_USERNAME = "assistent_life_hub_bot";

export function botToken(): string | null {
  return process.env.TELEGRAM_BOT_TOKEN?.trim() || null;
}

export function isBotConfigured(): boolean {
  return botToken() !== null;
}

export function botUsername(): string {
  return (process.env.TELEGRAM_BOT_USERNAME?.trim() || DEFAULT_BOT_USERNAME).replace(/^@/, "");
}

export function telegramApiBase(): string {
  const override = process.env.TELEGRAM_API_BASE?.trim();
  if (override && process.env.NODE_ENV !== "production") return override.replace(/\/+$/, "");
  return "https://api.telegram.org";
}

/**
 * Адрес сайта для кнопок в сообщениях бота. Сводку шлёт обработчик расписания,
 * у которого нет входящего запроса с адресом, — поэтому переменная (vars в
 * wrangler.jsonc), а не заголовки запроса, как в utils/origin.ts.
 */
export function siteUrl(): string {
  const configured = process.env.SITE_URL?.trim() || process.env.NEXT_PUBLIC_SITE_URL?.trim();
  return (configured || "https://life-hub.aarara.workers.dev").replace(/\/+$/, "");
}

/** Ссылка, открывающая чат с ботом; с кодом — сразу привязка аккаунта. */
export function botLink(startCode?: string): string {
  const base = `https://t.me/${botUsername()}`;
  return startCode ? `${base}?start=${startCode}` : base;
}

/**
 * Сколько сообщений в сутки на аккаунт разбирает ИИ. Бесплатная квота Workers AI
 * общая на весь сайт; без предела один активный пользователь мог бы выбрать её
 * за всех. Сверх предела бот понимает только простые шаблоны.
 */
export const AI_MESSAGES_PER_DAY = 60;

/** Голосовые длиннее не расшифровываются — берегут ту же квоту. */
export const MAX_VOICE_SECONDS = 120;
