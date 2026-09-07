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

import { getCurrentUser } from "@/lib/auth/user";

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
 * Оборачивает работу с базой: проверяет, что пользователь вошёл (иначе —
 * понятный отказ вместо записи в никуда), передаёт его id в operation, а
 * непредвиденные исключения превращает в понятное сообщение, оставляя стек
 * в серверных логах.
 *
 * Проверка входа именно здесь, в одном месте, а не в каждом действии
 * отдельно: способ узнать пользователя один на всё приложение, и дублировать
 * его в полусотне действий — верный способ забыть в одном из них.
 */
export async function guard<TData>(
  operation: (userId: string) => Promise<ActionResult<TData>>,
): Promise<ActionResult<TData>> {
  try {
    const user = await getCurrentUser();
    if (!user) return failure("Сессия истекла. Войдите заново.");

    return await operation(user.id);
  } catch (error) {
    console.error("[action]", error);
    return failure("Не удалось сохранить. Проверьте подключение к базе и повторите.");
  }
}
