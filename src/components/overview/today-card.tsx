import { ArrowUpRight, CalendarOff } from "lucide-react";
import Link from "next/link";

import { Panel, PanelHeader } from "@/components/ui/panel";
import { resolvePairTime } from "@/config/schedule";
import type { ScheduleSlot, Weekday } from "@/lib/types";
import { WEEKDAY_NAMES } from "@/lib/utils/date";

/**
 * Пары на сегодня.
 * Компонент серверный: расписание не меняется в процессе просмотра обзора,
 * поэтому клиентская интерактивность здесь не нужна.
 */

interface TodayCardProps {
  slots: ScheduleSlot[];
  weekday: Weekday;
}

export function TodayCard({ slots, weekday }: TodayCardProps) {
  return (
    <Panel className="flex flex-col">
      <PanelHeader
        eyebrow={WEEKDAY_NAMES[weekday]}
        title="Пары сегодня"
        actions={
          <Link
            href="/schedule"
            className="flex h-9 cursor-pointer items-center gap-1 rounded-full px-2.5 text-[12px] font-medium text-ink-muted transition-colors duration-200 hover:text-accent"
          >
            Расписание
            <ArrowUpRight size={14} />
          </Link>
        }
      />

      {slots.length === 0 ? (
        <p className="mt-4 flex flex-1 items-center gap-2 rounded-[10px] bg-surface-2 px-3 py-3 text-[12px] text-ink-muted">
          <CalendarOff size={14} className="shrink-0" />
          Сегодня пар нет.
        </p>
      ) : (
        <ul className="mt-4 flex flex-col">
          {slots.map((slot, index) => {
            const time = resolvePairTime(slot.pairIndex, slot.startTime, slot.endTime);

            return (
              <li
                key={slot.id}
                className={
                  index === 0 ? "flex gap-3 py-2" : "flex gap-3 border-t border-line py-2"
                }
              >
                <div className="flex w-[46px] shrink-0 flex-col">
                  <span className="tabular text-[12px] font-medium text-ink">{time.start}</span>
                  <span className="tabular text-[11px] text-ink-faint">{time.end}</span>
                </div>

                <span
                  className="w-[3px] shrink-0 rounded-full"
                  style={{ backgroundColor: slot.color }}
                  aria-hidden
                />

                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-ink">{slot.subject}</p>
                  {slot.room || slot.teacher ? (
                    <p className="truncate text-[11px] text-ink-muted">
                      {[slot.room, slot.teacher].filter(Boolean).join(" · ")}
                    </p>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
