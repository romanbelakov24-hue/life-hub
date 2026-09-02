"use server";

import { revalidatePath } from "next/cache";

import { failure, guard, success, type ActionResult } from "@/lib/actions/types";
import { rotateCalendarToken } from "@/lib/queries/settings";

/** Серверные действия раздела настроек. */

/**
 * Выпускает новый токен календарной ленты.
 *
 * Все существующие подписки после этого перестают обновляться — их придётся
 * добавить заново по новому адресу. Нужно ровно в одном случае: если старый
 * адрес куда-то утёк.
 */
export async function regenerateCalendarToken(): Promise<ActionResult<{ token: string }>> {
  return guard(async () => {
    const token = await rotateCalendarToken();
    if (!token) return failure("Не удалось выпустить новый адрес.");

    revalidatePath("/settings");
    return success({ token });
  });
}
