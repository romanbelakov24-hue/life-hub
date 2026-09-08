import type { CalendarEvent } from "@/lib/types";

/**
 * Раскладка дел с временем на почасовой сетке — день и неделя используют
 * один и тот же алгоритм, разница только в числе колонок дней.
 */

/** "14:30" -> 870 (минут от полуночи). Пустая строка — дело на весь день, сюда не попадает. */
function minutesOfDay(time: string): number {
  const [hours = "0", minutes = "0"] = time.split(":");
  return Number(hours) * 60 + Number(minutes);
}

export interface PositionedEvent {
  event: CalendarEvent;
  startMinutes: number;
  endMinutes: number;
  /** Своя колонка среди пересекающихся по времени дел. */
  column: number;
  /** Сколько всего колонок в этой группе пересечений — для ширины блока. */
  columnCount: number;
}

/**
 * Раскладывает дела одного дня по колонкам так, чтобы пересекающиеся по
 * времени не накладывались друг на друга визуально.
 *
 * Простой жадный алгоритм: события идут по возрастанию начала, каждое
 * занимает первую свободную колонку среди тех, что всё ещё «заняты» на
 * момент его начала. Группа пересечений (кластер) закрывается, когда очередное
 * событие начинается позже, чем закончились все предыдущие — тогда все дела
 * кластера получают одинаковую columnCount, поэтому блоки одной группы имеют
 * одинаковую ширину независимо от того, в какой момент кластера они начались.
 */
export function layoutDayEvents(events: CalendarEvent[]): PositionedEvent[] {
  const timed = events
    .filter((event) => event.startTime !== "" && event.endTime !== "")
    .map((event) => ({
      event,
      startMinutes: minutesOfDay(event.startTime),
      endMinutes: Math.max(minutesOfDay(event.endTime), minutesOfDay(event.startTime) + 15),
    }))
    .sort((a, b) => a.startMinutes - b.startMinutes || b.endMinutes - a.endMinutes);

  const result: PositionedEvent[] = [];
  let cluster: Array<{ event: CalendarEvent; startMinutes: number; endMinutes: number; column: number }> = [];
  let clusterEnd = -1;

  function flushCluster(): void {
    if (cluster.length === 0) return;
    const columnCount = Math.max(...cluster.map((item) => item.column)) + 1;
    for (const item of cluster) {
      result.push({ ...item, columnCount });
    }
    cluster = [];
  }

  for (const item of timed) {
    if (cluster.length > 0 && item.startMinutes >= clusterEnd) {
      flushCluster();
      clusterEnd = -1;
    }

    // Колонки, ещё занятые на момент начала текущего дела.
    const active = cluster.filter((entry) => entry.endMinutes > item.startMinutes);
    const usedColumns = new Set(active.map((entry) => entry.column));
    let column = 0;
    while (usedColumns.has(column)) column += 1;

    cluster.push({ ...item, column });
    clusterEnd = Math.max(clusterEnd, item.endMinutes);
  }
  flushCluster();

  return result;
}
