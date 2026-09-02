"use client";

import { useEffect } from "react";

/**
 * Единый трекер курсора на всё приложение.
 *
 * Пишет две вещи в CSS-переменные, а дальше всё делает сам CSS:
 *
 *   --px / --py  на <html>   — положение курсора в окне, от -1 до 1.
 *                              Фоновые пятна сдвигаются за курсором.
 *   --mx / --my  на панели   — координаты внутри элемента в пикселях.
 *                              По ним рисуется световое пятно под курсором.
 *
 * Почему один слушатель на документ, а не по слушателю в каждой панели:
 * панелей на экране до десяти, и десять независимых обработчиков pointermove
 * — это десять пересчётов на каждое движение мыши. Здесь обработчик один,
 * а нужная панель находится через closest().
 *
 * Обновление привязано к кадру через requestAnimationFrame: pointermove
 * приходит чаще, чем экран успевает перерисоваться, и без этого мы бы считали
 * геометрию впустую.
 *
 * На тач-устройствах и при «уменьшить движение» трекер не подключается вовсе.
 */
export function PointerTracker() {
  useEffect(() => {
    const canHover = window.matchMedia("(hover: hover)").matches;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (!canHover || reducedMotion) return;

    let frameId = 0;
    let lastEvent: PointerEvent | null = null;

    const apply = () => {
      frameId = 0;
      const event = lastEvent;
      if (!event) return;

      const root = document.documentElement;
      root.style.setProperty("--px", String((event.clientX / window.innerWidth) * 2 - 1));
      root.style.setProperty("--py", String((event.clientY / window.innerHeight) * 2 - 1));

      const target = event.target;
      if (!(target instanceof Element)) return;

      const panel = target.closest<HTMLElement>("[data-spotlight]");
      if (!panel) return;

      const rect = panel.getBoundingClientRect();
      panel.style.setProperty("--mx", `${event.clientX - rect.left}px`);
      panel.style.setProperty("--my", `${event.clientY - rect.top}px`);
    };

    const onPointerMove = (event: PointerEvent) => {
      lastEvent = event;
      if (!frameId) frameId = requestAnimationFrame(apply);
    };

    window.addEventListener("pointermove", onPointerMove, { passive: true });

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      if (frameId) cancelAnimationFrame(frameId);
    };
  }, []);

  return null;
}
