"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

/**
 * Цвета для графиков.
 *
 * Recharts принимает цвета атрибутами SVG, а `var(--token)` в атрибутах
 * работает ненадёжно. Поэтому один раз после монтирования (и после каждой
 * смены темы) читаем вычисленные значения CSS-переменных и отдаём их числами.
 *
 * До монтирования используется светлая палитра — она же прописана в :root,
 * так что первый кадр совпадает с серверным рендером.
 */

export interface ChartTheme {
  ink: string;
  inkMuted: string;
  inkFaint: string;
  line: string;
  accent: string;
  surface: string;
  positive: string;
}

const FALLBACK: ChartTheme = {
  ink: "#17140f",
  inkMuted: "#5f584c",
  inkFaint: "#71695c",
  line: "#e4ddd0",
  accent: "#bf3d18",
  surface: "#ffffff",
  positive: "#1a7a4e",
};

const VARIABLE_MAP: Record<keyof ChartTheme, string> = {
  ink: "--ink",
  inkMuted: "--ink-muted",
  inkFaint: "--ink-faint",
  line: "--line",
  accent: "--accent",
  surface: "--surface",
  positive: "--positive",
};

export function useChartTheme(): ChartTheme {
  const { resolvedTheme } = useTheme();
  const [theme, setTheme] = useState<ChartTheme>(FALLBACK);

  useEffect(() => {
    const styles = getComputedStyle(document.documentElement);

    const next = {} as ChartTheme;
    for (const [key, variable] of Object.entries(VARIABLE_MAP)) {
      const value = styles.getPropertyValue(variable).trim();
      next[key as keyof ChartTheme] = value || FALLBACK[key as keyof ChartTheme];
    }

    setTheme(next);
  }, [resolvedTheme]);

  return theme;
}
