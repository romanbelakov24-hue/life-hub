"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * Тонкая полоса загрузки сверху экрана.
 *
 * Закрывает окно между тапом по ссылке и появлением скелетона страницы
 * (loading.tsx у конкретного раздела): без какого-либо отклика это окно на
 * медленной сети или на холодном старте серверлес-функции выглядит как
 * зависшее приложение, а не как «уже открывается».
 *
 * Начало ловим перехватом кликов по внутренним ссылкам на document — у
 * App Router нет единого события «навигация началась». Конец — по смене
 * pathname/searchParams: они меняются, как только роутер начинает рендерить
 * новый сегмент, то есть примерно тогда же, когда появляется его loading.tsx —
 * дальше эстафету принимает уже скелетон конкретной страницы.
 */
export function RouteProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    function onClick(event: MouseEvent) {
      // Открытие в новой вкладке, копирование ссылки и т.п. — не навигация
      // внутри приложения, полосу показывать незачем.
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const target = event.target;
      const anchor =
        target instanceof Element ? target.closest<HTMLAnchorElement>("a[href]") : null;
      if (!anchor) return;
      if (anchor.target && anchor.target !== "_self") return;
      if (anchor.hasAttribute("download")) return;

      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;

      // Тот же путь и те же параметры — переход по якорю на этой же
      // отрисованной странице, сегмент заново не грузится.
      if (url.pathname === window.location.pathname && url.search === window.location.search) {
        return;
      }

      setVisible(true);
    }

    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  useEffect(() => {
    setVisible(false);
    // Каждая смена пути или параметров — отдельный переход, который стоит
    // отследить заново.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, searchParams.toString()]);

  if (!visible) return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-[2.5px] overflow-hidden"
    >
      <div className="animate-route-progress h-full w-1/3 rounded-r-full bg-accent shadow-[0_0_12px_var(--glow-strong)]" />
    </div>
  );
}
