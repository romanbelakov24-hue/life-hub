import { defineCloudflareConfig } from "@opennextjs/cloudflare";

/**
 * Конфигурация сборки OpenNext для Cloudflare Workers.
 *
 * Без переопределений: инкрементальный кэш (KV) не подключён намеренно — см.
 * комментарий в wrangler.jsonc.
 */
export default defineCloudflareConfig();
