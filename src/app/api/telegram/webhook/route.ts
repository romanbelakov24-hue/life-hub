import { botToken } from "@/lib/telegram/config";
import { handleUpdate } from "@/lib/telegram/handle-update";
import { webhookSecret } from "@/lib/telegram/secrets";
import type { TgUpdate } from "@/lib/telegram/types";
import { safeEqual } from "@/lib/utils/token";

/**
 * Вебхук общего Telegram-бота: сюда Telegram присылает каждое сообщение и
 * нажатие кнопки. Адрес и секрет регистрирует `npm run telegram:setup`.
 *
 * Подлинность — по заголовку X-Telegram-Bot-Api-Secret-Token: его знает только
 * Telegram (секрет передан ему при регистрации вебхука). Без совпадения — 401,
 * иначе любой мог бы прислать «обновление» от имени чужого чата.
 *
 * Ответ всегда 200, даже если обработка упала: на не-2xx Telegram повторяет
 * доставку снова и снова, а повтор той же ошибки ничего не исправит. Повторы
 * от задержек отсекает журнал bot_events по update_id.
 */

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const token = botToken();
  if (!token) return new Response("bot is not configured", { status: 503 });

  const received = request.headers.get("x-telegram-bot-api-secret-token") ?? "";
  if (!safeEqual(received, await webhookSecret(token))) {
    return new Response("unauthorized", { status: 401 });
  }

  let update: TgUpdate;
  try {
    update = (await request.json()) as TgUpdate;
  } catch {
    return new Response("bad request", { status: 400 });
  }
  if (typeof update?.update_id !== "number") return new Response("bad request", { status: 400 });

  try {
    await handleUpdate(update);
  } catch (error) {
    console.error("[bot] update", update.update_id, error instanceof Error ? error.message : error);
  }
  return new Response("ok");
}
