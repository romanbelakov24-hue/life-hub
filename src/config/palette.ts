/**
 * Палитра для категорий трат, предметов и графиков.
 *
 * Оттенки подобраны так, чтобы:
 *  • различаться между собой при беглом взгляде на донат-график;
 *  • сохранять контраст с текстом и на светлой, и на тёмной теме;
 *  • не сливаться с акцентным цветом интерфейса.
 */

export interface PaletteEntry {
  /** HEX, который уходит в базу и в Recharts. */
  value: string;
  /** Подпись в пикере цвета. */
  label: string;
}

export const PALETTE: PaletteEntry[] = [
  { value: "#e0642f", label: "Оранжевый" },
  { value: "#c4457c", label: "Малиновый" },
  { value: "#7a5af8", label: "Фиолетовый" },
  { value: "#2f80ed", label: "Синий" },
  { value: "#12a594", label: "Бирюзовый" },
  { value: "#4f9d2f", label: "Зелёный" },
  { value: "#c99700", label: "Золотой" },
  { value: "#d94f4f", label: "Красный" },
  { value: "#0e7490", label: "Морской" },
  { value: "#9a3412", label: "Кирпичный" },
  { value: "#5b21b6", label: "Индиго" },
  { value: "#7e8894", label: "Серый" },
];

/** Цвет по умолчанию для новых категорий и предметов. */
export const DEFAULT_COLOR = "#7e8894";

/** Значения палитры одним массивом — удобно для графиков. */
export const PALETTE_VALUES: string[] = PALETTE.map((entry) => entry.value);

/** Детерминированный цвет по строке — для предметов, у которых цвет не задан. */
export function colorFromString(input: string): string {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) % 100_000;
  }
  return PALETTE_VALUES[hash % PALETTE_VALUES.length] ?? DEFAULT_COLOR;
}

/**
 * Полупрозрачная заливка того же цвета — для фонов чипсов и ячеек.
 * Возвращает CSS-строку rgb(... / alpha), которая корректно работает в обеих темах.
 */
export function withAlpha(hex: string, alpha: number): string {
  const normalized = hex.replace("#", "");
  const red = parseInt(normalized.slice(0, 2), 16);
  const green = parseInt(normalized.slice(2, 4), 16);
  const blue = parseInt(normalized.slice(4, 6), 16);

  if ([red, green, blue].some(Number.isNaN)) return "transparent";

  return `rgb(${red} ${green} ${blue} / ${alpha})`;
}
