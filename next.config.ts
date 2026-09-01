import path from "node:path";

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Нативный биндинг libSQL нельзя бандлить — оставляем его внешним пакетом.
  serverExternalPackages: ["@libsql/client", "libsql"],

  // Явно фиксируем корень проекта: иначе Next подхватывает чужой
  // package-lock.json выше по дереву (например, в домашней папке)
  // и строит трассировку файлов не от той директории.
  outputFileTracingRoot: path.join(__dirname),
};

export default nextConfig;
