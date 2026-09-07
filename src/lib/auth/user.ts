import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";

import { readSessionToken, resolveSessionUserId } from "@/lib/auth/session";
import { findUserById, type AppUser } from "@/lib/queries/users";

/**
 * Текущий пользователь запроса.
 *
 * Обёрнуто в React cache(): и layout (для проверки доступа), и сама страница
 * обычно спрашивают «кто вошёл» — без кеша это была бы лишняя пара запросов
 * (сессия + пользователь) на каждый такой вызов в пределах одного рендера.
 * cache() живёт ровно один серверный рендер, между запросами не путается.
 */
export const getCurrentUser = cache(async (): Promise<AppUser | null> => {
  const token = await readSessionToken();
  if (!token) return null;

  const userId = await resolveSessionUserId(token);
  if (!userId) return null;

  return findUserById(userId);
});

/**
 * Как getCurrentUser(), но требует вход: без сессии сразу редиректит на
 * /login. Использовать в начале каждой страницы из группы (app) — сама
 * группа уже проверяет доступ в layout.tsx, а здесь просто нужен user.id для
 * выборок из базы.
 */
export async function requireUser(): Promise<AppUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}
