import "server-only";

import { getCloudflareContext } from "@opennextjs/cloudflare";

import { buildIntentMessages, INTENT_SCHEMA, normalizeIntent, type BotIntent, type IntentContext } from "./intent";
import { parseByRules } from "./rules";

/**
 * Workers AI — «мозг» бота. Работает внутри аккаунта Cloudflare, на котором и
 * так живёт сайт: ни отдельного ключа, ни чужой подписки. Бесплатная квота —
 * 10 000 «нейронов» в сутки на аккаунт; сообщение стоит порядка 30 нейронов,
 * голосовое на полминуты — ещё около 25.
 *
 * Привязка AI объявлена в wrangler.jsonc. В `next dev` getCloudflareContext
 * сам поднимает прокси wrangler, и привязка AI ходит в НАСТОЯЩИЙ Workers AI того
 * аккаунта, под которым залогинен wrangler, — тратя его квоту. Поэтому локально
 * ИИ выключен, пока явно не задано BOT_DEV_AI=1: без него бот понимает только
 * шаблоны (rules.ts).
 */

interface AiBinding {
  run(model: string, input: Record<string, unknown>): Promise<unknown>;
}

/** Модель с JSON-режимом и приличным русским. Можно сменить переменной окружения. */
const TEXT_MODEL = process.env.BOT_LLM_MODEL?.trim() || "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
const SPEECH_MODEL = "@cf/openai/whisper-large-v3-turbo";
/** Первая версия Whisper — запасная: принимает байты, а не base64. */
const SPEECH_FALLBACK_MODEL = "@cf/openai/whisper";

export async function getAi(): Promise<AiBinding | null> {
  if (process.env.NODE_ENV !== "production" && process.env.BOT_DEV_AI !== "1") return null;
  try {
    const { env } = await getCloudflareContext({ async: true });
    const binding = (env as unknown as { AI?: AiBinding }).AI;
    return binding ?? null;
  } catch {
    return null;
  }
}

/** Ответ модели: в JSON-режиме response — объект, иногда всё же строка. */
function extractJson(output: unknown): unknown {
  const response = (output as { response?: unknown } | null)?.response;
  if (response && typeof response === "object") return response;
  if (typeof response === "string") {
    const start = response.indexOf("{");
    const end = response.lastIndexOf("}");
    if (start !== -1 && end > start) return JSON.parse(response.slice(start, end + 1));
  }
  throw new Error("Модель не вернула JSON");
}

/**
 * Понять сообщение. С ИИ — модель + normalizeIntent; без ИИ или при ошибке
 * модели (кончилась квота, таймаут) — шаблоны. usedAi = true, только если
 * ответ действительно дала модель: по нему считается суточный предел.
 */
export async function understand(
  text: string,
  context: IntentContext,
  ai: AiBinding | null,
): Promise<{ intent: BotIntent; usedAi: boolean }> {
  if (ai) {
    try {
      const output = await ai.run(TEXT_MODEL, {
        messages: buildIntentMessages(text, context),
        response_format: { type: "json_schema", json_schema: INTENT_SCHEMA },
        temperature: 0.1,
        max_tokens: 400,
      });
      return { intent: normalizeIntent(extractJson(output), context), usedAi: true };
    } catch (error) {
      console.error("[bot] ai:text", error instanceof Error ? error.message : error);
    }
  }
  return { intent: parseByRules(text, context), usedAi: false };
}

/** Расшифровка голосового (ogg/opus из Telegram). Пустая строка — речи нет. */
export async function transcribe(ai: AiBinding, audio: ArrayBuffer): Promise<string> {
  const bytes = new Uint8Array(audio);
  try {
    const output = (await ai.run(SPEECH_MODEL, {
      audio: Buffer.from(bytes).toString("base64"),
      language: "ru",
    })) as { text?: string };
    return (output.text ?? "").trim();
  } catch (error) {
    console.error("[bot] ai:speech", error instanceof Error ? error.message : error);
    const output = (await ai.run(SPEECH_FALLBACK_MODEL, { audio: Array.from(bytes) })) as { text?: string };
    return (output.text ?? "").trim();
  }
}
