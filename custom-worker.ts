/**
 * Точка входа воркера Cloudflare: обычный обработчик сайта от OpenNext плюс
 * обработчик расписания (cron в wrangler.jsonc).
 *
 * Расписание не выполняет логику само, а вызывает маршрут /api/cron/digest
 * внутри того же воркера: так рассылка живёт в коде Next.js со всеми его
 * модулями (база, запросы, тексты), а здесь остаётся только «постучать».
 *
 * Схема из документации OpenNext: https://opennext.js.org/cloudflare/howtos/custom-worker
 */

// .open-next/worker.js появляется только после `opennextjs-cloudflare build`, поэтому
// файл исключён из tsconfig: собирает его wrangler (esbuild) уже после сборки OpenNext.
import { default as handler } from "./.open-next/worker.js";

import { cronSecret } from "./src/lib/telegram/secrets";

interface Env {
  TELEGRAM_BOT_TOKEN?: string;
  SITE_URL?: string;
}

interface ScheduledContext {
  waitUntil(promise: Promise<unknown>): void;
}

type FetchHandler = (request: Request, env: Env, ctx: ScheduledContext) => Promise<Response>;

const worker = handler as { fetch: FetchHandler };

const entry = {
  fetch: worker.fetch,

  async scheduled(_event: unknown, env: Env, ctx: ScheduledContext): Promise<void> {
    if (!env.TELEGRAM_BOT_TOKEN) return;
    const origin = (env.SITE_URL || "https://life-hub.aarara.workers.dev").replace(/\/+$/, "");
    const request = new Request(`${origin}/api/cron/digest`, {
      method: "POST",
      headers: { "x-cron-secret": await cronSecret(env.TELEGRAM_BOT_TOKEN) },
    });
    const response = await worker.fetch(request, env, ctx);
    if (!response.ok) console.error("[cron] digest", response.status, await response.text());
  },
};

export default entry;
