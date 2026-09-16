"use server";

import { revalidatePath } from "next/cache";

import { failure, guard, success, type ActionResult } from "@/lib/actions/types";
import {
  issueAgentToken,
  revokeAgentToken,
  rotateCalendarToken,
  rotateHealthToken,
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
  return guard(async (userId) => {
    const token = await rotateCalendarToken(userId);
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
  return guard(async (userId) => {
    await setShareEnabled(userId, enabled);

    revalidatePath("/settings");
    return success(null);
  });
}

/** Выпускает новый адрес сводки. Все разосланные ссылки перестают работать. */
export async function regenerateShareToken(): Promise<ActionResult<{ token: string }>> {
  return guard(async (userId) => {
    const token = await rotateShareToken(userId);
    if (!token) return failure("Не удалось выпустить новый адрес.");

    revalidatePath("/settings");
    return success({ token });
  });
}

/**
 * Выпускает новый адрес вебхука здоровья.
 *
 * Автоматизацию в «Быстрых командах» после этого нужно перенастроить на новый
 * URL — нужно, если старый адрес куда-то утёк (например, случайно попал в
 * скриншот или в переписку).
 */
export async function regenerateHealthToken(): Promise<ActionResult<{ token: string }>> {
  return guard(async (userId) => {
    const token = await rotateHealthToken(userId);
    if (!token) return failure("Не удалось выпустить новый адрес.");

    revalidatePath("/health");
    return success({ token });
  });
}

/**
 * Выпускает токен агента KAIROS — впервые или взамен старого.
 *
 * Токен возвращается ровно один раз: в базе остаётся только его хеш (см.
 * queries/settings.ts). Старый токен, если был, с этого момента не принимается.
 */
export async function issueAgentAccess(): Promise<ActionResult<{ token: string }>> {
  return guard(async (userId) => {
    const token = await issueAgentToken(userId);

    revalidatePath("/settings");
    return success({ token });
  });
}

/** Отзывает доступ агента: следующий его запрос получит 401. */
export async function revokeAgentAccess(): Promise<ActionResult<null>> {
  return guard(async (userId) => {
    await revokeAgentToken(userId);

    revalidatePath("/settings");
    return success(null);
  });
}
