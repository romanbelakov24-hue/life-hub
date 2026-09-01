/**
 * Иконки категорий трат.
 *
 * В базе хранится строковый ключ (`icon`), а не сам компонент, поэтому весь
 * маппинг ключ -> компонент собран здесь. Добавляешь категорию с новой иконкой —
 * дописываешь одну строку в CATEGORY_ICONS.
 *
 * Эмодзи в качестве иконок не используем: они по-разному выглядят на разных
 * платформах и не наследуют цвет текста.
 */

import type { LucideIcon } from "lucide-react";
import {
  Book,
  Bus,
  Car,
  Coffee,
  Dumbbell,
  Gamepad2,
  Gift,
  GraduationCap,
  Heart,
  Home,
  Plane,
  Shirt,
  ShoppingCart,
  Smartphone,
  Tag,
  Utensils,
  Wifi,
} from "lucide-react";

export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  "shopping-cart": ShoppingCart,
  utensils: Utensils,
  coffee: Coffee,
  bus: Bus,
  car: Car,
  "graduation-cap": GraduationCap,
  book: Book,
  "gamepad-2": Gamepad2,
  home: Home,
  shirt: Shirt,
  smartphone: Smartphone,
  wifi: Wifi,
  heart: Heart,
  dumbbell: Dumbbell,
  gift: Gift,
  plane: Plane,
  tag: Tag,
};

/** Ключи иконок для пикера в форме категории. */
export const ICON_KEYS: string[] = Object.keys(CATEGORY_ICONS);

/** Безопасное получение компонента: неизвестный ключ отдаёт нейтральный Tag. */
export function getCategoryIcon(key: string): LucideIcon {
  return CATEGORY_ICONS[key] ?? Tag;
}
