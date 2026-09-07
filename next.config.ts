import path from "node:path";

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Нативный биндинг libSQL нельзя бандлить — оставляем его внешним пакетом.
  // @libsql/hrana-client и @libsql/isomorphic-ws — его транзитивные зависимости
  // (транспорт по WebSocket): они собраны с условным экспортом "workerd",
  // который должен резолвиться средой выполнения Cloudflare Workers в момент
  // запуска, а не esbuild заранее — если их бандлить, сборка под Cloudflare
  // падает на «Could not resolve @libsql/isomorphic-ws».
  serverExternalPackages: [
    "@libsql/client",
    "libsql",
    "@libsql/hrana-client",
    "@libsql/isomorphic-ws",
  ],

  // Явно фиксируем корень проекта: иначе Next подхватывает чужой
  // package-lock.json выше по дереву (например, в домашней папке)
  // и строит трассировку файлов не от той директории.
  outputFileTracingRoot: path.join(__dirname),

  // Трассировка файлов у Next запускается под Node.js и резолвит условные
  // экспорты пакетов по условию "node" — из @libsql/isomorphic-ws в копию для
  // серверлес-функции попадают только node.mjs/node.cjs, а web.mjs/web.cjs
  // (нужные под условие "workerd", которое применяет уже OpenNext при сборке
  // под Cloudflare) трассировщик не видит и не копирует вовсе. Форсируем их
  // явным списком — единственный официальный способ расширить то, что нашла
  // трассировка, когда пакет собран под рантайм, отличный от того, что видит
  // сама сборка.
  outputFileTracingIncludes: {
    "/**": [
      "./node_modules/@libsql/isomorphic-ws/web.mjs",
      "./node_modules/@libsql/isomorphic-ws/web.cjs",
    ],
  },
};

export default nextConfig;
