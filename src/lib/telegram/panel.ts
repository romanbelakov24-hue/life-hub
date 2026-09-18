import "server-only";

import { botLink, botUsername, isBotConfigured } from "./config";
import { findLinkByUser, listRecentBotEvents, type BotEventItem } from "./store";

/** Всё, что показывает панель «Telegram-бот» в настройках. */
export interface TelegramPanelState {
  /** Задан ли токен бота на сервере. Нет — панель объясняет, что бот выключен. */
  configured: boolean;
  botUsername: string;
  botUrl: string;
  link: {
    username: string;
    firstName: string;
    linkedAt: string;
    digestEnabled: boolean;
    digestTime: string;
    timezone: string;
  } | null;
  recent: BotEventItem[];
}

export async function loadTelegramPanel(userId: string): Promise<TelegramPanelState> {
  const [link, recent] = await Promise.all([findLinkByUser(userId), listRecentBotEvents(userId)]);
  return {
    configured: isBotConfigured(),
    botUsername: botUsername(),
    botUrl: botLink(),
    link: link
      ? {
          username: link.username,
          firstName: link.firstName,
          linkedAt: link.linkedAt,
          digestEnabled: link.digestEnabled,
          digestTime: link.digestTime,
          timezone: link.timezone,
        }
      : null,
    recent,
  };
}

/** Время сводки — любое в сутках шагом 15 минут: чаще расписание воркера не срабатывает. */
export const DIGEST_TIME_PATTERN = /^([01]\d|2[0-3]):(00|15|30|45)$/;
