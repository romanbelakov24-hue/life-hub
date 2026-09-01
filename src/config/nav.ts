/**
 * Навигация приложения — единый источник для сайдбара (десктоп) и нижнего
 * таб-бара (мобильные). Добавляешь новый раздел? Достаточно дописать пункт сюда.
 *
 * Ограничение: в нижнем таб-баре не должно быть больше 5 пунктов
 * (рекомендация мобильных гайдлайнов — иначе цели касания становятся тесными).
 */

import type { LucideIcon } from "lucide-react";
import { CalendarDays, LayoutGrid, ListChecks, NotebookPen, Wallet } from "lucide-react";

export type NavSection = "overview" | "money" | "study";

export interface NavItem {
  href: string;
  /** Полная подпись — сайдбар. */
  label: string;
  /** Короткая подпись — нижний таб-бар на телефоне. */
  shortLabel: string;
  icon: LucideIcon;
  section: NavSection;
}

export const NAV_ITEMS: NavItem[] = [
  {
    href: "/",
    label: "Обзор",
    shortLabel: "Обзор",
    icon: LayoutGrid,
    section: "overview",
  },
  {
    href: "/expenses",
    label: "Расходы",
    shortLabel: "Расходы",
    icon: Wallet,
    section: "money",
  },
  {
    href: "/schedule",
    label: "Расписание",
    shortLabel: "Пары",
    icon: CalendarDays,
    section: "study",
  },
  {
    href: "/tasks",
    label: "Задачи",
    shortLabel: "Задачи",
    icon: ListChecks,
    section: "study",
  },
  {
    href: "/notes",
    label: "Заметки",
    shortLabel: "Заметки",
    icon: NotebookPen,
    section: "study",
  },
];

/** Заголовки групп в сайдбаре. */
export const SECTION_LABELS: Record<NavSection, string> = {
  overview: "Главное",
  money: "Финансы",
  study: "Учёба",
};

/** Порядок групп в сайдбаре. */
export const SECTION_ORDER: NavSection[] = ["overview", "money", "study"];

/**
 * Активен ли пункт для текущего пути.
 * Корень "/" совпадает строго, остальные — по префиксу (чтобы вложенные
 * маршруты вроде /expenses/settings тоже подсвечивали свой раздел).
 */
export function isNavItemActive(href: string, pathname: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
