"use server";

import { revalidatePath } from "next/cache";

import { failure, guard, success, type ActionResult } from "@/lib/actions/types";
import { botLink, isBotConfigured } from "@/lib/telegram/config";
import { DEFAULT_TIME_ZONE, isValidTimeZone } from "@/lib/telegram/dates";
import { sendDigestNow } from "@/lib/telegram/digest";
import { DIGEST_TIME_PATTERN, loadTelegramPanel, type TelegramPanelState } from "@/lib/telegram/panel";
import { createLinkCode, findLinkByUser, unlinkUser, updateDigestSettings } from "@/lib/telegram/store";

/**
 * Действия панели «Telegram-бот» в настройках. Пользователь — только из
 * сессии (guard): привязать чат к чужому аккаунту отсюда нельзя.
 */

function zoneOrDefault(timeZone: string): string {
  return isValidTimeZone(timeZone) ? timeZone : DEFAULT_TIME_ZONE;
}

/**
 * Одноразовая ссылка t.me/<бот>?start=<код>, живёт 15 минут. Часовой пояс
 * браузера запоминается вместе с кодом — «завтра» и время сводки бот будет
 * считать по часам человека.
 */
export async function startTelegramLink(timeZone: string): Promise<ActionResult<{ url: string }>> {
  if (!isBotConfigured()) return failure("Бот ещё не подключён к сайту.");
  return guard(async (userId) => {
    const code = await createLinkCode(userId, zoneOrDefault(timeZone));
    return success({ url: botLink(code) });
  });
}

/** Состояние панели — панель опрашивает его, пока ждёт подтверждения в Telegram. */
export async function getTelegramPanel(): Promise<ActionResult<TelegramPanelState>> {
  return guard(async (userId) => success(await loadTelegramPanel(userId)));
}

export async function saveTelegramDigest(input: {
  enabled: boolean;
  time: string;
  timeZone: string;
}): Promise<ActionResult<null>> {
  if (!DIGEST_TIME_PATTERN.test(input.time)) return failure("Время — с шагом 15 минут, например 08:00.");
  return guard(async (userId) => {
    const updated = await updateDigestSettings(userId, {
      enabled: input.enabled,
      time: input.time,
      timezone: zoneOrDefault(input.timeZone),
    });
    if (!updated) return failure("Сначала подключите Telegram.");
    revalidatePath("/settings");
    return success(null);
  });
}

export async function unlinkTelegram(): Promise<ActionResult<null>> {
  return guard(async (userId) => {
    await unlinkUser(userId);
    revalidatePath("/settings");
    revalidatePath("/");
    return success(null);
  });
}

export async function sendTelegramDigestNow(): Promise<ActionResult<null>> {
  return guard(async (userId) => {
    const link = await findLinkByUser(userId);
    if (!link) return failure("Сначала подключите Telegram.");
    try {
      await sendDigestNow(link);
    } catch (error) {
      console.error("[bot] digest now", error instanceof Error ? error.message : error);
      return failure("Telegram не принял сообщение. Проверьте, не остановлен ли бот в чате.");
    }
    return success(null);
  });
}
