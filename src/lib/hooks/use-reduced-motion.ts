"use client";

import { useEffect, useState } from "react";

/**
 * Включена ли системная настройка «уменьшить движение».
 *
 * CSS-анимации гасятся медиа-запросом в globals.css, но библиотечные анимации
 * (Recharts рисует их через JS) о нём не знают — им нужно передать флаг явно.
 *
 * Начальное значение — false, чтобы серверный рендер и первый клиентский кадр
 * совпали. Реальное значение приходит после монтирования; для анимаций этого
 * достаточно, потому что до монтирования они всё равно не запускаются.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(query.matches);

    const onChange = (event: MediaQueryListEvent) => setReduced(event.matches);
    query.addEventListener("change", onChange);

    return () => query.removeEventListener("change", onChange);
  }, []);

  return reduced;
}
