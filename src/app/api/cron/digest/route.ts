import { botToken } from "@/lib/telegram/config";
import { sendDueDigests } from "@/lib/telegram/digest";
import { cronSecret } from "@/lib/telegram/secrets";
import { safeEqual } from "@/lib/utils/token";

/**
 * Рассылка утренних сводок. Вызывает обработчик расписания воркера
 * (custom-worker.ts) каждые 15 минут; кому пора — решает sendDueDigests.
 *
 * Снаружи маршрут закрыт секретом в заголовке x-cron-secret: он выводится из
 * токена бота, и знает его только сам воркер.
 */

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const token = botToken();
  if (!token) return Response.json({ ok: false, error: "bot is not configured" }, { status: 503 });

  const received = request.headers.get("x-cron-secret") ?? "";
  if (!safeEqual(received, await cronSecret(token))) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const result = await sendDueDigests();
  return Response.json({ ok: true, ...result });
}
