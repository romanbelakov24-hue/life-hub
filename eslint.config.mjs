import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({ baseDirectory: __dirname });

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      // Генерируется Next.js, вручную не редактируется.
      "next-env.d.ts",
      // Нативный проект Capacitor: внутри лежат вендорные cordova.js и
      // native-bridge.js, которые правилами нашего проекта проверять
      // бессмысленно — мы их не пишем и не правим.
      "android/**",
      // Статика: сюда скриптом кладётся минифицированный воркер pdf.js.
      "public/**",
      // Сборка под Cloudflare Workers (OpenNext) и локальный запуск Wrangler —
      // сгенерированный и вендорный код, вручную не редактируется.
      ".open-next/**",
      ".wrangler/**",
    ],
  },
];

export default eslintConfig;
