import { ArrowUpRight, CalendarOff } from "lucide-react";
import Link from "next/link";

import { SourceBadge } from "@/components/ui/misc";
import { Panel, PanelHeader } from "@/components/ui/panel";
import type { CalendarEvent, IsoDate } from "@/lib/types";
import { formatRelativeDay } from "@/lib/utils/date";

/**
 * Ближайшие дела из календаря.
 * Компонент серверный: список не меняется в процессе просмотра обзора,
 * поэтому клиентская интерактивность здесь не нужна.
 *
 * Каждое дело — посадочный талон (.pass-card, globals.css): корешок цветом
 * дела + пунктирный отрыв, вместо ряда с тонкой чёрточкой слева. Тот же
 * язык, что у последних трат в MoneyCard рядом — оба виджета «Обзора»
 * говорят об элементах списка одинаково.
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
        <ul className="mt-4 flex flex-col gap-2">
          {events.map((event) => (
            <li key={event.id} className="pass-card bg-surface-2/70">
              <span className="pass-stub" style={{ backgroundColor: event.color }} aria-hidden />
              <div className="pass-body flex min-w-0 flex-1 items-center gap-3 py-2 pl-3 pr-3">
                <div className="flex w-[68px] shrink-0 flex-col">
                  <span className="text-[12px] font-medium text-ink">
                    {formatRelativeDay(event.date, today)}
                  </span>
                  {event.startTime ? (
                    <span className="tabular text-[11px] text-ink-faint">{event.startTime}</span>
                  ) : null}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="flex min-w-0 items-center gap-1.5 text-[13px] font-medium text-ink">
                    <span className="truncate">{event.title}</span>
                    <SourceBadge source={event.source} />
                  </p>
                  {event.location ? (
                    <p className="truncate text-[11px] text-ink-muted">{event.location}</p>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
