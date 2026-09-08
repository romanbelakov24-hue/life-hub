import { ArrowUpRight, CalendarOff } from "lucide-react";
import Link from "next/link";

import { Panel, PanelHeader } from "@/components/ui/panel";
import type { CalendarEvent, IsoDate } from "@/lib/types";
import { formatRelativeDay } from "@/lib/utils/date";

/**
 * Ближайшие дела из календаря.
 * Компонент серверный: список не меняется в процессе просмотра обзора,
 * поэтому клиентская интерактивность здесь не нужна.
 */

interface TodayCardProps {
  events: CalendarEvent[];
  today: IsoDate;
  /** Порядковый номер в сетке — задаёт задержку появления. */
  index?: number;
}

export function TodayCard({ events, today, index }: TodayCardProps) {
  return (
    <Panel className="flex flex-col" index={index}>
      <PanelHeader
        eyebrow="Календарь"
        title="Ближайшие дела"
        actions={
          <Link
            href="/schedule"
            className="flex h-9 cursor-pointer items-center gap-1 rounded-full px-2.5 text-[12px] font-medium text-ink-muted transition-colors duration-200 hover:text-accent"
          >
            Календарь
            <ArrowUpRight size={14} />
          </Link>
        }
      />

      {events.length === 0 ? (
        <p className="mt-4 flex flex-1 items-center gap-2 rounded-[10px] bg-surface-2 px-3 py-3 text-[12px] text-ink-muted">
          <CalendarOff size={14} className="shrink-0" />
          Ничего не запланировано.
        </p>
      ) : (
        <ul className="mt-4 flex flex-col">
          {events.map((event, eventIndex) => (
            <li
              key={event.id}
              className={
                eventIndex === 0 ? "flex gap-3 py-2" : "flex gap-3 border-t border-line py-2"
              }
            >
              <div className="flex w-[70px] shrink-0 flex-col">
                <span className="text-[12px] font-medium text-ink">
                  {formatRelativeDay(event.date, today)}
                </span>
                {event.startTime ? (
                  <span className="tabular text-[11px] text-ink-faint">{event.startTime}</span>
                ) : null}
              </div>

              <span
                className="w-[3px] shrink-0 rounded-full"
                style={{ backgroundColor: event.color }}
                aria-hidden
              />

              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium text-ink">{event.title}</p>
                {event.location ? (
                  <p className="truncate text-[11px] text-ink-muted">{event.location}</p>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
