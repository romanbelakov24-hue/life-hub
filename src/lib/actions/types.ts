/**
 * Общий контракт серверных действий.
 *
 * Действия никогда не бросают исключения наружу: любая ошибка возвращается
 * как `{ ok: false, error }`, и компонент показывает её пользователю рядом с
 * формой. Так интерфейс не падает целиком из-за одной неудачной записи.
 *
 * Файл намеренно без директивы "use server": в модуле серверных действий
 * можно экспортировать только async-функции, а типы должны жить отдельно.
 */

export type ActionResult<TData = null> =
  | { ok: true; data: TData }
  | { ok: false; error: string };

/** Успешный результат. */
export function success<TData>(data: TData): ActionResult<TData> {
  return { ok: true, data };
}

/** Ошибка с текстом для пользователя (на русском, без технических деталей). */
export function failure(error: string): ActionResult<never> {
  return { ok: false, error };
}

/**
 * Оборачивает работу с базой: непредвиденные исключения превращаются
 * в понятное сообщение, а стек уходит в серверные логи.
 */
export async function guard<TData>(
  operation: () => Promise<ActionResult<TData>>,
): Promise<ActionResult<TData>> {
  try {
    return await operation();
  } catch (error) {
    console.error("[action]", error);
    return failure("Не удалось сохранить. Проверьте подключение к базе и повторите.");
  }
}
