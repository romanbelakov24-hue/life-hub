import { SkeletonPage } from "@/components/ui/skeleton";

/**
 * Экран загрузки. Next показывает его, пока серверный компонент ждёт базу.
 * Без него переход между разделами выглядит как зависание: браузер держит
 * предыдущую страницу и ничем не показывает, что нажатие сработало.
 */
export default function Loading() {
  return <SkeletonPage panels={3} rows={5} />;
}
