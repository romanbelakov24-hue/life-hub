import "server-only";

import type { Row } from "@libsql/client";

import { db } from "@/lib/db/client";
import { str } from "@/lib/db/rows";
import type { CalendarEvent, IsoDate } from "@/lib/types";

/**
 * Чтение календарных дел. Как и в остальных queries — только выборки,
 * без бизнес-логики.
 */

function mapEvent(row: Row): CalendarEvent {
  return {
    id: str(row, "id"),
    date: str(row, "date"),
    startTime: str(row, "start_time"),
    endTime: str(row, "end_time"),
    title: str(row, "title"),
    location: str(row, "location"),
    description: str(row, "description"),
    color: str(row, "color"),
    createdAt: str(row, "created_at"),
  };
}

const EVENT_SELECT = `
  SELECT id, date, start_time, end_time, title, location, description, color, created_at
    FROM events
`;

/** Дела за диапазон дат включительно — сетка календаря запрашивает ровно то, что видно на экране. */
export async function listEventsInRange(
  userId: string,
  from: IsoDate,
  to: IsoDate,
): Promise<CalendarEvent[]> {
  const client = await db();
  const result = await client.execute({
    sql: `${EVENT_SELECT}
           WHERE user_id = ? AND date BETWEEN ? AND ?
           ORDER BY date ASC, start_time ASC`,
    args: [userId, from, to],
  });

  return result.rows.map(mapEvent);
}

/** Ближайшие предстоящие дела от указанной даты — для виджета обзора. */
export async function listUpcomingEvents(
  userId: string,
  from: IsoDate,
  limit = 5,
): Promise<CalendarEvent[]> {
  const client = await db();
  const result = await client.execute({
    sql: `${EVENT_SELECT}
           WHERE user_id = ? AND date >= ?
           ORDER BY date ASC, start_time ASC
           LIMIT ?`,
    args: [userId, from, limit],
  });

  return result.rows.map(mapEvent);
}
