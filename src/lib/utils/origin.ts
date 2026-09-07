import { headers } from "next/headers";

/**
 * Абсолютный адрес сайта — для ссылок, которые уходят наружу: лента
 * календаря, вебхук здоровья, публичная сводка.
 *
 * Если задан NEXT_PUBLIC_SITE_URL — берём его. Без этого ссылки собирались
 * из заголовков самого запроса, а у Netlify на каждый деплой есть ещё и
 * отдельный превью-адрес (`<id>--life-hub8.netlify.app`) — если открыть сайт
 * именно через него и скопировать оттуда ссылку на календарь, она будет вести
 * на этот конкретный деплой, а не на основной сайт, и сломается на следующей
 * сборке. Фиксированная переменная окружения снимает эту случайность для
 * продакшна.
 *
 * Без переменной (локальная разработка, сами превью-деплои) поведение
 * прежнее — собираем адрес из заголовков запроса: фиксированного адреса там
 * и не может быть.
 */
export async function resolveSiteOrigin(): Promise<string> {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) return configured.replace(/\/+$/, "");

  const headerList = await headers();
  const host = headerList.get("host") ?? "localhost:3000";
  const protocol =
    headerList.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");

  return `${protocol}://${host}`;
}
