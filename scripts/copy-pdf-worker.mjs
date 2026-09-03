/**
 * Кладёт воркер pdf.js в public.
 *
 * Библиотека выносит разбор PDF в отдельный поток и грузит воркер по URL.
 * Копируем файл скриптом, а не руками: иначе при обновлении pdfjs-dist в
 * public остался бы воркер от старой версии, а рассинхрон версий библиотеки
 * и воркера pdf.js не прощает — падает при первом же открытии файла.
 *
 * Запускается автоматически перед dev и build (см. package.json).
 */

import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);

const packageJson = require.resolve("pdfjs-dist/package.json");
const source = join(dirname(packageJson), "build", "pdf.worker.min.mjs");

if (!existsSync(source)) {
  console.error(`Воркер pdf.js не найден: ${source}`);
  process.exit(1);
}

mkdirSync("public", { recursive: true });
copyFileSync(source, join("public", "pdf.worker.min.mjs"));

console.log("Воркер pdf.js скопирован в public/pdf.worker.min.mjs");
