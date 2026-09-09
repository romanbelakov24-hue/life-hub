"use client";

import { MapPin } from "lucide-react";

import { layoutDayEvents } from "@/lib/utils/calendar-layout";
import type { CalendarEvent, IsoDate } from "@/lib/types";
import { cn } from "@/lib/utils/cn";
import { WEEKDAY_SHORT, weekdayOf } from "@/lib/utils/date";

/**
 * Почасовая сетка на N дней — общий рендер для дневного и недельного вида.
 *
 * Часы с 7 до 23: раньше и позже пар и большинства дел почти не бывает,
 * а растягивать сетку на все 24 часа — это в основном пустой скролл.
 * Дела на весь день показываются отдельной строкой сверху, не в сетке.
 */

const START_HOUR = 7;
const END_HOUR = 23;
const HOUR_HEIGHT = 56;
const TOTAL_MINUTES = (END_HOUR - START_HOUR) * 60;

interface TimeGridProps {
  days: IsoDate[];
  eventsByDate: Map<IsoDate, CalendarEvent[]>;
  today: IsoDate;
  onEventClick: (event: CalendarEvent) => void;
  /** Клик по пустому месту сетки — создать дело на этот день и примерное время. */
  onSlotClick: (date: IsoDate, time: string) => void;
}

/** Y-координата клика -> минуты от START_HOUR, округлённые до получаса. */
function offsetToTime(offsetY: number): string {
  const minutesFromStart = Math.max(0, Math.min(TOTAL_MINUTES, (offsetY / HOUR_HEIGHT) * 60));
  const roundedHalfHour = Math.round(minutesFromStart / 30) * 30;
  const totalMinutes = START_HOUR * 60 + roundedHalfHour;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function nowOffset(): number | null {
  const now = new Date();
  const minutesFromStart = now.getHours() * 60 + now.getMinutes() - START_HOUR * 60;
  if (minutesFromStart < 0 || minutesFromStart > TOTAL_MINUTES) return null;
  return (minutesFromStart / 60) * HOUR_HEIGHT;
}

export function TimeGrid({ days, eventsByDate, today, onEventClick, onSlotClick }: TimeGridProps) {
  const hours = Array.from({ length: END_HOUR - START_HOUR }, (_, index) => START_HOUR + index);
  const todayOffset = days.includes(today) ? nowOffset() : null;

  return (
    <div className="glass glass-blur overflow-hidden rounded-[14px] border border-line bg-surface/88">
      {/* Заголовки дней */}
      <div
        className="grid border-b border-line"
        style={{ gridTemplateColumns: `56px repeat(${days.length}, 1fr)` }}
      >
        <div />
        {days.map((day) => {
          const isToday = day === today;
          return (
            <div
              key={day}
              className={cn(
                "flex flex-col items-center gap-0.5 border-l border-line py-2",
                isToday && "bg-accent-soft",
              )}
            >
              <span className="text-[10px] font-medium uppercase text-ink-faint">
                {WEEKDAY_SHORT[weekdayOf(day)]}
              </span>
              <span
                className={cn(
                  "tabular flex h-6 w-6 items-center justify-center rounded-full text-[13px] font-semibold",
                  isToday ? "bg-accent text-accent-ink" : "text-ink",
                )}
              >
                {Number(day.slice(8, 10))}
              </span>
            </div>
          );
        })}
      </div>

      {/* Дела на весь день */}
      {days.some((day) => (eventsByDate.get(day) ?? []).some((event) => event.startTime === "")) ? (
        <div
          className="grid border-b border-line"
          style={{ gridTemplateColumns: `56px repeat(${days.length}, 1fr)` }}
        >
          <div className="py-1.5 pr-1.5 text-right text-[9px] text-ink-faint">весь день</div>
          {days.map((day) => (
            <div key={day} className="flex flex-col gap-1 border-l border-line p-1">
              {(eventsByDate.get(day) ?? [])
                .filter((event) => event.startTime === "")
                .map((event) => (
                  <button
                    key={event.id}
                    type="button"
                    onClick={() => onEventClick(event)}
                    className="cursor-pointer truncate rounded-[5px] px-1.5 py-0.5 text-left text-[11px] font-medium text-white"
                    style={{ backgroundColor: event.color }}
                  >
                    {event.title}
                  </button>
                ))}
            </div>
          ))}
        </div>
      ) : null}

      {/* Почасовая сетка */}
      <div className="relative overflow-x-auto">
        <div className="grid" style={{ gridTemplateColumns: `56px repeat(${days.length}, minmax(96px, 1fr))` }}>
          {/* Колонка часов */}
          <div>
            {hours.map((hour) => (
              <div
                key={hour}
                className="border-b border-line pr-1.5 text-right text-[10px] text-ink-faint"
                style={{ height: HOUR_HEIGHT }}
              >
                <span className="relative -top-2">{hour}:00</span>
              </div>
            ))}
          </div>

          {/* Колонки дней */}
          {days.map((day) => {
            const positioned = layoutDayEvents(eventsByDate.get(day) ?? []);
            const isToday = day === today;

            return (
              <div
                key={day}
                className={cn("relative border-l border-line", isToday && "bg-accent-soft/30")}
                style={{ height: hours.length * HOUR_HEIGHT }}
                onClick={(clickEvent) => {
                  // Клик именно по пустой сетке, не по блоку дела поверх нее.
                  if (clickEvent.target !== clickEvent.currentTarget) return;
                  const rect = clickEvent.currentTarget.getBoundingClientRect();
                  onSlotClick(day, offsetToTime(clickEvent.clientY - rect.top));
                }}
              >
                {hours.map((hour) => (
                  <div
                    key={hour}
                    className="cursor-pointer border-b border-line/70 hover:bg-surface-2"
                    style={{ height: HOUR_HEIGHT }}
                  />
                ))}

                {positioned.map(({ event, startMinutes, endMinutes, column, columnCount }) => {
                  const top = ((startMinutes - START_HOUR * 60) / 60) * HOUR_HEIGHT;
                  const height = ((endMinutes - startMinutes) / 60) * HOUR_HEIGHT;
                  const widthPercent = 100 / columnCount;

                  return (
                    <button
                      key={event.id}
                      type="button"
                      onClick={() => onEventClick(event)}
                      className="absolute cursor-pointer overflow-hidden rounded-[6px] px-1.5 py-1 text-left text-white shadow-sm"
                      style={{
                        top,
                        height: Math.max(height, 20),
                        left: `${column * widthPercent}%`,
                        width: `calc(${widthPercent}% - 2px)`,
                        backgroundColor: event.color,
                      }}
                    >
                      <p className="truncate text-[11px] font-medium leading-tight">{event.title}</p>
                      {height >= 36 ? (
                        <p className="truncate text-[10px] leading-tight opacity-85">
                          {event.startTime}
                          {event.location ? (
                            <span className="ml-1 inline-flex items-center gap-0.5">
                              <MapPin size={9} className="inline" />
                              {event.location}
                            </span>
                          ) : null}
                        </p>
                      ) : null}
                    </button>
                  );
                })}

                {isToday && todayOffset !== null ? (
                  <div
                    className="pointer-events-none absolute inset-x-0 z-10 flex items-center"
                    style={{ top: todayOffset }}
                  >
                    <span className="h-2 w-2 -translate-x-1 rounded-full bg-negative" />
                    <span className="h-px flex-1 bg-negative" />
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
