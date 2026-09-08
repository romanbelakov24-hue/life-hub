"use client";

import { ChevronLeft, ChevronRight, MapPin, Plus } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

import { EventEditor, type EventEditorTarget } from "@/components/study/event-editor";
import type { CalendarEvent, IsoDate } from "@/lib/types";
import { cn } from "@/lib/utils/cn";
import {
  addDays,
  endOfMonth,
  endOfWeek,
  formatDayMonth,
  formatMonthTitle,
  formatRelativeDay,
  startOfMonth,
  startOfWeek,
  WEEKDAY_SHORT,
} from "@/lib/utils/date";

/**
 * Календарь дел: месячная сетка сверху, список дел выбранного дня снизу.
 *
 * Месяц живёт в URL (?month=2026-10) — как у страницы расходов: ссылку на
 * конкретный месяц можно сохранить, «назад» в браузере работает предсказуемо.
 * Выбранный день внутри месяца — состояние компонента: сетка уже содержит все
 * дела на экране, повторный запрос к серверу за этим не нужен.
 */

interface EventCalendarProps {
  monthAnchor: IsoDate;
  events: CalendarEvent[];
  today: IsoDate;
  currentMonthKey: string;
}

export function EventCalendar({ monthAnchor, events, today, currentMonthKey }: EventCalendarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const monthKey = monthAnchor.slice(0, 7);
  const isCurrentMonth = monthKey === currentMonthKey;

  // День по умолчанию: сегодня, если он в этом месяце, иначе первое число.
  const [selectedDate, setSelectedDate] = useState<IsoDate>(
    isCurrentMonth ? today : startOfMonth(monthAnchor),
  );
  const [editorTarget, setEditorTarget] = useState<EventEditorTarget | null>(null);

  function goToMonth(offset: number): void {
    const [year = 2026, month = 1] = monthAnchor.split("-").map(Number);
    const date = new Date(year, month - 1 + offset, 1);
    const nextMonthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

    const params = new URLSearchParams(searchParams.toString());
    params.set("month", nextMonthKey);
    router.push(`${pathname}?${params.toString()}`);
  }

  // Сетка накрывает целые недели: с понедельника недели, где 1-е число,
  // по воскресенье недели, где последнее число месяца — иначе первая и
  // последняя строка сетки были бы обрезаны с одной стороны.
  const gridDays = useMemo(() => {
    const gridStart = startOfWeek(startOfMonth(monthAnchor));
    const gridEnd = endOfWeek(endOfMonth(monthAnchor));
    const days: IsoDate[] = [];
    for (let cursor = gridStart; cursor <= gridEnd; cursor = addDays(cursor, 1)) {
      days.push(cursor);
    }
    return days;
  }, [monthAnchor]);

  const eventsByDate = useMemo(() => {
    const map = new Map<IsoDate, CalendarEvent[]>();
    for (const event of events) {
      const list = map.get(event.date) ?? [];
      list.push(event);
      map.set(event.date, list);
    }
    return map;
  }, [events]);

  const selectedEvents = eventsByDate.get(selectedDate) ?? [];

  return (
    <>
      <div data-spotlight className="spotlight relative rounded-[14px] border border-line bg-surface/85 p-3 backdrop-blur-xl sm:p-4">
        {/* Навигация по месяцам */}
        <div className="mb-3 flex items-center justify-between">
          <button
            type="button"
            aria-label="Предыдущий месяц"
            onClick={() => goToMonth(-1)}
            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-ink-muted transition-colors duration-200 hover:bg-surface-2 hover:text-ink"
          >
            <ChevronLeft size={18} />
          </button>

          <p className="text-[15px] font-semibold text-ink">{formatMonthTitle(monthAnchor)}</p>

          <button
            type="button"
            aria-label="Следующий месяц"
            onClick={() => goToMonth(1)}
            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-ink-muted transition-colors duration-200 hover:bg-surface-2 hover:text-ink"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        {/* Заголовки дней недели */}
        <div className="grid grid-cols-7 gap-1">
          {([1, 2, 3, 4, 5, 6, 7] as const).map((weekday) => (
            <p
              key={weekday}
              className="eyebrow py-1.5 text-center !text-[10px]"
              aria-hidden
            >
              {WEEKDAY_SHORT[weekday]}
            </p>
          ))}
        </div>

        {/* Сетка дней */}
        <div className="grid grid-cols-7 gap-1">
          {gridDays.map((day) => {
            const inMonth = day.slice(0, 7) === monthKey;
            const isToday = day === today;
            const isSelected = day === selectedDate;
            const dayEvents = eventsByDate.get(day) ?? [];

            return (
              <button
                key={day}
                type="button"
                onClick={() => setSelectedDate(day)}
                className={cn(
                  "flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-[10px]",
                  "transition-colors duration-200",
                  isSelected
                    ? "bg-accent text-accent-ink"
                    : isToday
                      ? "bg-accent-soft text-accent"
                      : inMonth
                        ? "text-ink hover:bg-surface-2"
                        : "text-ink-faint hover:bg-surface-2",
                )}
              >
                <span className="tabular text-[13px] font-medium leading-none">
                  {Number(day.slice(8, 10))}
                </span>

                {dayEvents.length > 0 ? (
                  <span className="flex gap-[3px]" aria-hidden>
                    {dayEvents.slice(0, 3).map((event) => (
                      <span
                        key={event.id}
                        className="h-[5px] w-[5px] rounded-full"
                        style={{
                          backgroundColor: isSelected ? "currentColor" : event.color,
                        }}
                      />
                    ))}
                  </span>
                ) : (
                  <span className="h-[5px]" aria-hidden />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Список дел выбранного дня */}
      <div
        data-spotlight
        className="spotlight relative mt-4 rounded-[14px] border border-line bg-surface/85 p-4 backdrop-blur-xl"
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="eyebrow mb-1">{formatRelativeDay(selectedDate, today)}</p>
            <p className="text-[13px] text-ink-muted">{formatDayMonth(selectedDate)}</p>
          </div>

          <button
            type="button"
            onClick={() => setEditorTarget({ date: selectedDate, event: null })}
            className="flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-full bg-accent px-3.5 text-[13px] font-medium text-accent-ink transition-[filter] duration-200 hover:brightness-110"
          >
            <Plus size={15} />
            Добавить
          </button>
        </div>

        {selectedEvents.length === 0 ? (
          <p className="mt-4 rounded-[10px] bg-surface-2 px-3 py-3 text-center text-[12px] text-ink-muted">
            На этот день ничего не запланировано
          </p>
        ) : (
          <ul className="mt-4 flex flex-col gap-1.5">
            {selectedEvents.map((event) => (
              <li key={event.id}>
                <button
                  type="button"
                  onClick={() => setEditorTarget({ date: event.date, event })}
                  className="flex w-full cursor-pointer items-start gap-3 rounded-[10px] border border-line bg-surface px-3 py-2.5 text-left transition-colors duration-200 hover:bg-surface-2"
                  style={{ borderLeft: `3px solid ${event.color}` }}
                >
                  <div className="w-[46px] shrink-0 pt-0.5">
                    {event.startTime ? (
                      <>
                        <p className="tabular text-[12px] font-medium text-ink">
                          {event.startTime}
                        </p>
                        <p className="tabular text-[11px] text-ink-faint">{event.endTime}</p>
                      </>
                    ) : (
                      <p className="text-[11px] text-ink-faint">Весь день</p>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-ink">{event.title}</p>
                    {event.location ? (
                      <p className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-ink-muted">
                        <MapPin size={11} className="shrink-0" />
                        {event.location}
                      </p>
                    ) : null}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <EventEditor target={editorTarget} onClose={() => setEditorTarget(null)} />
    </>
  );
}
