import type { ReactNode } from "react";

import { AppShell } from "@/components/layout/app-shell";

/**
 * Layout приватной части приложения — всё, что за навигацией.
 *
 * Вынесено в route group `(app)`, чтобы публичная страница-сводка `/s/<токен>`
 * не получала каркас с меню. Это не косметика: у приложения нет авторизации,
 * и меню на публичной странице стало бы прямой дорожкой ко всем данным для
 * любого, кому досталась ссылка.
 *
 * Скобки в имени папки означают, что `(app)` не попадает в URL: обзор
 * по-прежнему лежит на `/`, расходы на `/expenses`.
 */
export default function AppLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
