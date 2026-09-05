import { cn } from "@/lib/utils/cn";

/**
 * Заглушки на время загрузки страницы.
 *
 * Данные лежат в базе другого региона, и полсекунды ожидания неизбежны. Но без
 * скелетона браузер держит на экране предыдущую страницу и не подаёт признаков
 * жизни — переход читается как зависание. Со скелетоном то же самое время
 * ощущается как загрузка: видно, что нажатие сработало и что именно грузится.
 *
 * Поэтому формы заглушек повторяют реальную раскладку страницы, а не рисуют
 * абстрактные полосы: когда придут данные, содержимое встанет на те же места
 * и не будет скачка вёрстки.
 */

/** Прямоугольник-заглушка с мягкой пульсацией. */
export function SkeletonBox({ className }: { className?: string }) {
  return (
    <div
      className={cn("animate-pulse rounded-[8px] bg-surface-3", className)}
      aria-hidden
    />
  );
}

/** Шапка страницы: микро-подпись, заголовок, описание. */
export function SkeletonPageHeader() {
  return (
    <div className="mb-5 border-b border-line pb-5 sm:mb-6">
      <SkeletonBox className="h-2.5 w-16" />
      <SkeletonBox className="mt-3 h-8 w-48 sm:h-10 sm:w-64" />
      <SkeletonBox className="mt-3 h-3 w-40" />
    </div>
  );
}

/** Панель с заголовком и несколькими строками. */
export function SkeletonPanel({
  rows = 3,
  className,
}: {
  rows?: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-[14px] border border-line bg-surface/85 p-4 backdrop-blur-xl sm:p-5",
        className,
      )}
    >
      <SkeletonBox className="h-2.5 w-14" />
      <SkeletonBox className="mt-2.5 h-4 w-36" />

      <div className="mt-5 flex flex-col gap-3">
        {Array.from({ length: rows }, (_, index) => (
          <div key={index} className="flex items-center gap-3">
            <SkeletonBox className="h-8 w-8 shrink-0 rounded-[9px]" />
            <SkeletonBox className="h-3 flex-1" />
            <SkeletonBox className="h-3 w-14 shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Экран целиком: шапка и сетка панелей. */
export function SkeletonPage({ panels = 2, rows = 3 }: { panels?: number; rows?: number }) {
  return (
    <>
      <SkeletonPageHeader />
      <div className="flex flex-col gap-4">
        {Array.from({ length: panels }, (_, index) => (
          <SkeletonPanel key={index} rows={rows} />
        ))}
      </div>
    </>
  );
}
