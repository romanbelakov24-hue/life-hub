import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Минимальный парсер .env для скриптов — чтобы не тянуть зависимость.
 * Уже заданные переменные окружения не перезаписываются: первый загруженный
 * файл главнее следующих.
 */
export function loadEnvFile(fileName: string): void {
  let content: string;
  try {
    content = readFileSync(resolve(process.cwd(), fileName), "utf8");
  } catch {
    return; // Файла нет — работаем с тем, что уже есть в окружении.
  }

  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim().replace(/^["']|["']$/g, "");

    if (!process.env[key]) process.env[key] = value;
  }
}
