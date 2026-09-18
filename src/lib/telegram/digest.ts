import "server-only";

import { listEventsInRange } from "@/lib/queries/events";
import { listTasksFiltered } from "@/lib/queries/study";
import { findUserById } from "@/lib/queries/users";
import type { IsoDate } from "@/lib/types";
import { addDays } from "@/lib/utils/date";

import { sendMessage } from "./api";
import { siteUrl } from "./config";
import { zonedNow } from "./dates";
import { formatDigest, type DigestData } from "./format";
import { isDigestDue } from "./schedule";
import { listDigestSubscribers, markDigestSent, type TelegramLink } from "./store";

/**
 * Утренняя сводка: дела календаря и задачи на день — без денег. Расписание
 * воркера дёргает /api/cron/digest каждые 15 минут; кому пора — решает
 * isDigestDue (schedule.ts).
 */

export async function collectDigest(
  userId: string,
  today: IsoDate,
  name: string,
  localTime?: string,
): Promise<DigestData> {
  const weekEnd = addDays(today, 6);
  const [events, openTasks] = await Promise.all([
    listEventsInRange(userId, today, today),
    listTasksFiltered(userId, { status: "open", to: weekEnd, limit: 100 }),
  ]);

  return {
    name,
    today,
    localTime,
    events,
    dueToday: openTasks.filter((task) => task.dueDate === today),
    overdue: openTasks.filter((task) => task.dueDate !== "" && task.dueDate < today),
    upcoming: openTasks.filter((task) => task.dueDate > today && task.dueDate <= weekEnd),
  };
}

/** Отправить сводку «сейчас» — команда /today и кнопка в настройках. */
export async function sendDigestNow(link: Pick<TelegramLink, "userId" | "chatId" | "timezone">): Promise<void> {
  const user = await findUserById(link.userId);
  const { date, time } = zonedNow(link.timezone);
  const data = await collectDigest(link.userId, date, user?.name ?? "", time);
  await sendMessage(link.chatId, formatDigest(data), {
    keyboard: [[{ text: "Открыть life hub ↗", url: siteUrl() }]],
  });
}

/** Разослать всем, кому пора. Ошибка у одного получателя не останавливает остальных. */
export async function sendDueDigests(now: Date = new Date()): Promise<{ sent: number; failed: number }> {
  const subscribers = await listDigestSubscribers();
  let sent = 0;
  let failed = 0;

  for (const link of subscribers) {
    const { due, localDate } = isDigestDue(link, now);
    if (!due) continue;
    try {
      // Сначала отметка, потом отправка: при сбое на отправке человек лучше
      // останется без одной сводки, чем получит её несколько раз подряд.
      await markDigestSent(link.userId, localDate);
      const data = await collectDigest(link.userId, localDate, link.name, zonedNow(link.timezone, now).time);
      await sendMessage(link.chatId, formatDigest(data), {
        keyboard: [[{ text: "Открыть life hub ↗", url: siteUrl() }]],
      });
      sent += 1;
    } catch (error) {
      failed += 1;
      console.error("[bot] digest", link.userId, error instanceof Error ? error.message : error);
    }
  }
  return { sent, failed };
}
