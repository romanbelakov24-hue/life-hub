import type { ReactNode } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { requireUser } from "@/lib/auth/user";

/**
 * Layout приватной части приложения — всё, что за навигацией.
 *
 * Вынесено в route group `(app)`, чтобы публичная страница-сводка `/s/<токен>`
 * и страницы входа/регистрации не получали каркас с меню. Это не косметика: у
 * страниц вне этой группы нет проверки входа, и меню стало бы прямой дорожкой
 * ко всем данным для любого, кому досталась ссылка.
 *
 * Скобки в имени папки означают, что `(app)` не попадает в URL: обзор
 * по-прежнему лежит на `/`, расходы на `/expenses`.
 *
 * requireUser() здесь — единственная точка входа: без сессии редиректит на
 * /login раньше, чем отрисуется хоть одна страница из группы. Сами страницы
 * тоже вызывают requireUser() (или getCurrentUser()) — не ради повторной
 * проверки, а чтобы получить user.id для выборок; вызов кешируется React
 * cache() на весь рендер, второй раз в базу не ходит.
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  await requireUser();

  return <AppShell>{children}</AppShell>;
}
