"use server";

import { revalidatePath } from "next/cache";

import { failure, guard, success, type ActionResult } from "@/lib/actions/types";
import {
  rotateCalendarToken,
  rotateShareToken,
  setShareEnabled,
} from "@/lib/queries/settings";

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

/**
 * Включает или выключает публичную страницу-сводку.
 *
 * Адрес при этом не меняется: выключенная сводка отдаёт 404, включённая снова
 * открывается по прежней ссылке. Так доступ можно закрыть на время, не рассылая
 * потом новый адрес.
 */
export async function toggleShareSummary(enabled: boolean): Promise<ActionResult<null>> {
  return guard(async () => {
    await setShareEnabled(enabled);

    revalidatePath("/settings");
    return success(null);
  });
}

/** Выпускает новый адрес сводки. Все разосланные ссылки перестают работать. */
export async function regenerateShareToken(): Promise<ActionResult<{ token: string }>> {
  return guard(async () => {
    const token = await rotateShareToken();
    if (!token) return failure("Не удалось выпустить новый адрес.");

    revalidatePath("/settings");
    return success({ token });
  });
}
