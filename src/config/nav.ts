/**
 * Навигация приложения — единый источник для сайдбара (десктоп) и нижнего
 * таб-бара (мобильные). Добавляешь новый раздел? Достаточно дописать пункт сюда.
 *
 * Разделов больше пяти, а в нижнюю панель больше пяти ячеек не помещается без
 * потери размера цели касания. Поэтому у каждого пункта есть флаг `primary`:
 * первичные попадают в таб-бар, остальные — в шторку «Ещё». В сайдбаре на
 * десктопе видно всё сразу, там места хватает.
 */

import type { LucideIcon } from "lucide-react";
import {
  CalendarDays,
  HeartPulse,
  LayoutGrid,
  ListChecks,
  NotebookPen,
  Wallet,
} from "lucide-react";

export type NavSection = "overview" | "money" | "study" | "health";

export interface NavItem {
  href: string;
  /** Полная подпись — сайдбар и шторка. */
  label: string;
  /** Короткая подпись — нижний таб-бар на телефоне. */
  shortLabel: string;
  icon: LucideIcon;
  section: NavSection;
  /** Показывать в нижнем таб-баре. Непервичные уходят в шторку «Ещё». */
  primary: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  {
    href: "/",
    label: "Обзор",
    shortLabel: "Обзор",
    icon: LayoutGrid,
    section: "overview",
    primary: true,
  },
  {
    href: "/expenses",
    label: "Расходы",
    shortLabel: "Расходы",
    icon: Wallet,
    section: "money",
    primary: true,
  },
  {
    href: "/schedule",
    label: "Расписание",
    shortLabel: "Пары",
    icon: CalendarDays,
    section: "study",
    primary: true,
  },
  {
    href: "/tasks",
    label: "Задачи",
    shortLabel: "Задачи",
    icon: ListChecks,
    section: "study",
    primary: true,
  },
  {
    href: "/notes",
    label: "Заметки",
    shortLabel: "Заметки",
    icon: NotebookPen,
    section: "study",
    primary: false,
  },
  {
    href: "/health",
    label: "Здоровье",
    shortLabel: "Здоровье",
    icon: HeartPulse,
    section: "health",
    primary: false,
  },
];

/** Пункты нижнего таб-бара. Пятая ячейка занята кнопкой «Ещё». */
export const PRIMARY_NAV_ITEMS = NAV_ITEMS.filter((item) => item.primary);

/** Пункты, которые открываются из шторки «Ещё». */
export const SECONDARY_NAV_ITEMS = NAV_ITEMS.filter((item) => !item.primary);

/** Заголовки групп в сайдбаре. */
export const SECTION_LABELS: Record<NavSection, string> = {
  overview: "Главное",
  money: "Финансы",
  study: "Учёба",
  health: "Здоровье",
};

/** Порядок групп в сайдбаре. */
export const SECTION_ORDER: NavSection[] = ["overview", "money", "study", "health"];

/**
 * Активен ли пункт для текущего пути.
 * Корень "/" совпадает строго, остальные — по префиксу (чтобы вложенные
 * маршруты вроде /expenses/import тоже подсвечивали свой раздел).
 */
export function isNavItemActive(href: string, pathname: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
