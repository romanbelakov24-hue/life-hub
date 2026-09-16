"use server";

import { revalidatePath } from "next/cache";

import { failure, guard, success, type ActionResult } from "@/lib/actions/types";
import { db } from "@/lib/db/client";
import { insertEvents, validateEvent, type EventInput } from "@/lib/mutations/events";

/**
 * Серверные действия календаря. Правила те же, что в actions/expenses.ts —
 * валидация на сервере и revalidatePath после каждой записи.
 *
 * Создание дела и его проверка — в lib/mutations/events.ts: те же функции
 * вызывает API агента.
 */

function revalidateEventViews(): void {
  revalidatePath("/schedule");
  revalidatePath("/");
}

export async function createEvent(input: EventInput): Promise<ActionResult<{ id: string }>> {
  return guard(async (userId) => {
    const error = validateEvent(input);
    if (error) return failure(error);

    const id = await insertEvents(userId, input);

    revalidateEventViews();
    return success({ id });
  });
}

/** Правка одного дела — серии, созданные повтором, при этом не затрагиваются. */
export async function updateEvent(id: string, input: EventInput): Promise<ActionResult<null>> {
  return guard(async (userId) => {
    const error = validateEvent({ ...input, repeatWeeklyUntil: undefined });
    if (error) return failure(error);

    const client = await db();
    const result = await client.execute({
      sql: `UPDATE events
               SET date = ?, start_time = ?, end_time = ?, title = ?,
                   location = ?, description = ?, color = ?
             WHERE id = ? AND user_id = ?`,
      args: [
        input.date,
        input.startTime,
        input.endTime,
        input.title.trim(),
        input.location.trim(),
        input.description.trim(),
        input.color,
        id,
        userId,
      ],
    });

    if (result.rowsAffected === 0) return failure("Дело не найдено.");

    revalidateEventViews();
    return success(null);
  });
}

export async function deleteEvent(id: string): Promise<ActionResult<null>> {
  return guard(async (userId) => {
    const client = await db();
    await client.execute({
      sql: `DELETE FROM events WHERE id = ? AND user_id = ?`,
      args: [id, userId],
    });

    revalidateEventViews();
    return success(null);
  });
}
