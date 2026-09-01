/**
 * Генератор идентификаторов для записей.
 *
 * Формат `prefix_<12 hex>` вместо автоинкремента: id можно сгенерировать до
 * записи в базу (нужно для оптимистичных обновлений в UI) и он не раскрывает
 * количество записей.
 */
export function createId(prefix: string): string {
  const random = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
  return `${prefix}_${random}`;
}
