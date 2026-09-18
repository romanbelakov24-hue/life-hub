/**
 * Проверки перед `npm run cf:deploy` — выкатить сайт, который сразу упадёт,
 * должно быть нельзя.
 *
 * 1. Откуда воркер возьмёт ключи базы. Сборка OpenNext зашивает в код воркера
 *    всё из .env, .env.local, .env.production(.local) (next-env.mjs), а секреты
 *    Cloudflare главнее зашитого. Правильно — секреты; зашитые ключи работают,
 *    но уезжают внутри кода в каждую версию. Нет ни того, ни другого — отказ.
 * 2. Применены ли миграции на боевой базе. Схема идёт раньше кода: иначе новый
 *    код упадёт на отсутствующей колонке.
 */

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

/** Файлы, которые OpenNext зашивает в воркер (режим production). */
const BAKED_ENV_FILES = [".env", ".env.production", ".env.local", ".env.production.local"];
const DB_KEYS = ["TURSO_DATABASE_URL", "TURSO_AUTH_TOKEN"];
/** Без него сайт работает, но Telegram-бот и утренние сводки — нет. */
const BOT_KEY = "TELEGRAM_BOT_TOKEN";

function bakedKeys(): Set<string> {
  const keys = new Set<string>();
  for (const file of BAKED_ENV_FILES) {
    let content = "";
    try {
      content = readFileSync(file, "utf8");
    } catch {
      continue;
    }
    for (const line of content.split("\n")) {
      const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
      if (match?.[1] && match[2]?.trim()) keys.add(match[1]);
    }
  }
  return keys;
}

/** Имена секретов воркера; null — узнать не удалось (нет входа в wrangler, нет сети). */
function secretNames(): Set<string> | null {
  const result = spawnSync("npx wrangler secret list --format json", {
    shell: true,
    encoding: "utf8",
  });
  if (result.status !== 0) return null;
  try {
    const start = result.stdout.indexOf("[");
    const parsed = JSON.parse(result.stdout.slice(start)) as Array<{ name?: string }>;
    return new Set(parsed.map((secret) => secret.name ?? ""));
  } catch {
    return null;
  }
}

function main(): void {
  const baked = bakedKeys();
  const secrets = secretNames();
  const problems: string[] = [];
  const warnings: string[] = [];

  for (const key of DB_KEYS) {
    const inSecrets = secrets?.has(key) ?? false;
    const inBundle = baked.has(key);
    if (inSecrets && inBundle) {
      warnings.push(
        `${key} есть и в секретах, и в .env-файлах сборки: работает секрет, но копия ` +
          "всё равно зашивается в код воркера. Перенеси строку в .env.prod.local.",
      );
    } else if (!inSecrets && inBundle) {
      warnings.push(
        `${key} зашивается в код воркера из .env-файла. Перенеси в секрет: ` +
          `npx wrangler secret put ${key}`,
      );
    } else if (!inSecrets && !inBundle) {
      problems.push(
        secrets === null
          ? `${key}: не удалось прочитать секреты воркера (npx wrangler login?), а в .env-файлах его нет.`
          : `${key} не задан ни секретом, ни в .env-файлах — сайт не увидит базу. ` +
              `npx wrangler secret put ${key}`,
      );
    }
  }

  if (!(secrets?.has(BOT_KEY) ?? false)) {
    warnings.push(
      baked.has(BOT_KEY)
        ? `${BOT_KEY} зашивается в код воркера из .env-файла. Перенеси в секрет: npx wrangler secret put ${BOT_KEY}`
        : `${BOT_KEY} не задан — сайт выкатится, но Telegram-бот работать не будет.`,
    );
  }

  const migrations = spawnSync("npx tsx scripts/migrate.ts --prod --check", {
    shell: true,
    stdio: "inherit",
  });
  if (migrations.status !== 0) {
    problems.push("Миграции на боевой базе не применены: npm run db:migrate:prod");
  }

  for (const warning of warnings) console.warn(`⚠ ${warning}`);
  if (problems.length > 0) {
    for (const problem of problems) console.error(`✖ ${problem}`);
    console.error("Деплой остановлен.");
    process.exit(1);
  }
  console.log("Проверки перед деплоем пройдены.");
}

main();
