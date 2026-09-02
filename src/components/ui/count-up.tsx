"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { formatNumber, formatRub } from "@/lib/utils/format";

/**
 * Число, которое «доезжает» до значения вместо мгновенной подстановки.
 *
 * Смысл не в украшении: когда сумма меняется после добавления траты, движение
 * показывает, что изменилось именно это число и в какую сторону. При первом
 * открытии страницы счётчик едет от нуля, при обновлении — от прежнего значения.
 *
 * Серверный рендер отдаёт финальное значение, поэтому разметка сервера и первый
 * клиентский рендер совпадают — гидрация проходит чисто. Анимация стартует в
 * useLayoutEffect, то есть до отрисовки кадра, и подмены значения не видно.
 */

/** useLayoutEffect ругается на сервере — там подменяем его на useEffect. */
const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

const DURATION_MS = 850;

/** Плавное замедление к концу: быстрый старт, мягкая остановка. */
function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Формат задаётся ключом, а не функцией: компонент клиентский, а вызывают его
 * серверные (SummaryCards, StatsPanel, MoneyCard). Функцию через границу
 * сервер → клиент передать нельзя — она не сериализуется.
 */
export type CountFormat = "rub" | "rub-exact" | "number";

const FORMATTERS: Record<CountFormat, (value: number) => string> = {
  /** Рубли без копеек — крупные суммы в карточках итогов. */
  rub: (value) => formatRub(value, 0),
  /** Рубли с копейками — там, где важна точность. */
  "rub-exact": (value) => formatRub(value, 2),
  number: (value) => formatNumber(value, 0),
};

interface CountUpProps {
  value: number;
  format: CountFormat;
  className?: string;
}

export function CountUp({ value, format, className }: CountUpProps) {
  const formatValue = FORMATTERS[format];
  const [display, setDisplay] = useState(value);

  // Значение предыдущей анимации: с него стартует следующая.
  const fromRef = useRef(0);
  const frameRef = useRef<number | null>(null);

  useIsomorphicLayoutEffect(() => {
    const from = fromRef.current;
    fromRef.current = value;

    if (from === value) return;

    // Без анимации просто показываем итог — правило «уменьшить движение».
    if (prefersReducedMotion()) {
      setDisplay(value);
      return;
    }

    const start = performance.now();

    const step = (now: number) => {
      const progress = Math.min((now - start) / DURATION_MS, 1);
      setDisplay(from + (value - from) * easeOutCubic(progress));

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(step);
      }
    };

    frameRef.current = requestAnimationFrame(step);

    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, [value]);

  return <span className={className}>{formatValue(display)}</span>;
}
