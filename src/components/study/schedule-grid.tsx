"use client";

import { CalendarOff, Plus } from "lucide-react";
import { useMemo, useState } from "react";

import {
  ScheduleSlotEditor,
  type SlotEditorTarget,
} from "@/components/study/schedule-slot-editor";
import { PAIR_INDEXES, SCHEDULE_WEEKDAYS, resolvePairTime } from "@/config/schedule";
import type { ScheduleSlot, Weekday } from "@/lib/types";
import { cn } from "@/lib/utils/cn";
import { WEEKDAY_NAMES, WEEKDAY_SHORT } from "@/lib/utils/date";

/**
 * Сетка расписания.
 *
 * Два представления одних данных:
 *   • десктоп — таблица «дни × пары», видно всю неделю сразу;
 *   • телефон — один день со списком пар, потому что семь колонок на 375px
 *     превращаются в нечитаемые полоски. По умолчанию открыт сегодняшний день.
 *
 * Клик по любой ячейке (пустой или занятой) открывает одну и ту же форму.
 */

interface ScheduleGridProps {
  slots: ScheduleSlot[];
  /** Сегодняшний день недели — подсвечивается и открывается первым на телефоне. */
  todayWeekday: Weekday;
}

export function ScheduleGrid({ slots, todayWeekday }: ScheduleGridProps) {
  const [editorTarget, setEditorTarget] = useState<SlotEditorTarget | null>(null);

  // На телефоне показываем сегодняшний день; если сегодня выходной вне сетки —
  // первый учебный день недели.
  const [activeDay, setActiveDay] = useState<Weekday>(
    SCHEDULE_WEEKDAYS.includes(todayWeekday) ? todayWeekday : (SCHEDULE_WEEKDAYS[0] ?? 1),
  );

  /** Быстрый доступ к паре по ключу «день-номер». */
  const slotMap = useMemo(() => {
    const map = new Map<string, ScheduleSlot>();
    for (const slot of slots) {
      map.set(`${slot.weekday}-${slot.pairIndex}`, slot);
    }
    return map;
  }, [slots]);

  function openCell(weekday: Weekday, pairIndex: number) {
    setEditorTarget({
      weekday,
      pairIndex,
      slot: slotMap.get(`${weekday}-${pairIndex}`) ?? null,
    });
  }

  return (
    <>
      {/* ─── Десктоп: вся неделя таблицей ─────────────────────────────────── */}
      <div
        data-spotlight
        className="spotlight relative hidden overflow-x-auto rounded-[14px] border border-line bg-surface/85 backdrop-blur-xl lg:block"
      >
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="w-[92px] border-b border-r border-line px-3 py-2.5 text-left">
                <span className="eyebrow">пара</span>
              </th>

              {SCHEDULE_WEEKDAYS.map((weekday) => (
                <th
                  key={weekday}
                  scope="col"
                  className={cn(
                    "border-b border-line px-3 py-2.5 text-left",
                    weekday === todayWeekday && "bg-accent-soft",
                  )}
                >
                  <span
                    className={cn(
                      "text-[13px] font-semibold",
                      weekday === todayWeekday ? "text-accent" : "text-ink",
                    )}
                  >
                    {WEEKDAY_NAMES[weekday]}
                  </span>
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {PAIR_INDEXES.map((pairIndex) => (
              <tr key={pairIndex}>
                <th scope="row" className="border-b border-r border-line px-3 py-2 text-left">
                  <span className="tabular block text-sm font-semibold text-ink">
                    {pairIndex}
                  </span>
                  <span className="tabular block text-[10px] leading-tight text-ink-faint">
                    {resolvePairTime(pairIndex, "", "").start}
                  </span>
                </th>

                {SCHEDULE_WEEKDAYS.map((weekday) => {
                  const slot = slotMap.get(`${weekday}-${pairIndex}`);

                  return (
                    <td key={weekday} className="border-b border-line p-1 align-top">
                      <SlotCell
                        slot={slot}
                        pairIndex={pairIndex}
                        onClick={() => openCell(weekday, pairIndex)}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ─── Телефон: один день списком ───────────────────────────────────── */}
      <div className="lg:hidden">
        <div
          role="tablist"
          aria-label="День недели"
          className="mb-3 flex gap-1 overflow-x-auto pb-1"
        >
          {SCHEDULE_WEEKDAYS.map((weekday) => {
            const isActive = weekday === activeDay;
            const count = slots.filter((slot) => slot.weekday === weekday).length;

            return (
              <button
                key={weekday}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveDay(weekday)}
                className={cn(
                  "flex h-11 min-w-[52px] shrink-0 cursor-pointer flex-col items-center justify-center",
                  "rounded-[10px] border transition-colors duration-200",
                  isActive
                    ? "border-accent bg-accent text-accent-ink"
                    : "border-line bg-surface text-ink-muted",
                )}
              >
                <span className="text-[13px] font-semibold leading-none">
                  {WEEKDAY_SHORT[weekday]}
                </span>
                <span
                  className={cn(
                    "tabular mt-1 text-[10px] leading-none",
                    isActive ? "text-accent-ink/75" : "text-ink-faint",
                  )}
                >
                  {count > 0 ? `${count} пар.` : "—"}
                </span>
              </button>
            );
          })}
        </div>

        <ul className="flex flex-col gap-1.5">
          {PAIR_INDEXES.map((pairIndex) => {
            const slot = slotMap.get(`${activeDay}-${pairIndex}`);
            const time = resolvePairTime(pairIndex, slot?.startTime ?? "", slot?.endTime ?? "");

            return (
              <li key={pairIndex} className="flex items-stretch gap-2">
                <div className="flex w-[52px] shrink-0 flex-col justify-center py-1">
                  <span className="tabular text-[11px] font-medium text-ink-muted">
                    {time.start}
                  </span>
                  <span className="tabular text-[11px] text-ink-faint">{time.end}</span>
                </div>

                <button
                  type="button"
                  onClick={() => openCell(activeDay, pairIndex)}
                  className={cn(
                    "min-h-14 flex-1 cursor-pointer rounded-[10px] border px-3 py-2 text-left",
                    "transition-colors duration-200",
                    slot
                      ? "border-line bg-surface"
                      : "hatch border-dashed border-line bg-surface/40",
                  )}
                  style={
                    slot
                      ? { borderLeft: `3px solid ${slot.color}` }
                      : undefined
                  }
                >
                  {slot ? (
                    <>
                      <p className="text-sm font-medium text-ink">{slot.subject}</p>
                      <p className="mt-0.5 text-[12px] text-ink-muted">
                        {[slot.room, slot.teacher].filter(Boolean).join(" · ") || "—"}
                      </p>
                    </>
                  ) : (
                    <span className="flex items-center gap-1.5 text-[12px] text-ink-faint">
                      <Plus size={13} />
                      {pairIndex}-я пара — свободно
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>

        {slots.filter((slot) => slot.weekday === activeDay).length === 0 ? (
          <p className="mt-3 flex items-center justify-center gap-2 rounded-[10px] bg-surface-2 px-3 py-2.5 text-[12px] text-ink-muted">
            <CalendarOff size={14} />
            {WEEKDAY_NAMES[activeDay]} свободен — нажмите на любую пару, чтобы добавить предмет.
          </p>
        ) : null}
      </div>

      <ScheduleSlotEditor target={editorTarget} onClose={() => setEditorTarget(null)} />
    </>
  );
}

/** Ячейка десктопной сетки: занятая — цветная карточка, пустая — штриховка. */
function SlotCell({
  slot,
  pairIndex,
  onClick,
}: {
  slot: ScheduleSlot | undefined;
  pairIndex: number;
  onClick: () => void;
}) {
  const time = resolvePairTime(pairIndex, slot?.startTime ?? "", slot?.endTime ?? "");

  if (!slot) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={`Добавить предмет, пара ${pairIndex}`}
        className={cn(
          "hatch group flex h-[62px] w-full cursor-pointer items-center justify-center",
          "rounded-[8px] border border-dashed border-line",
          "transition-colors duration-200 hover:border-accent hover:bg-accent-soft",
        )}
      >
        <Plus
          size={15}
          className="text-ink-faint opacity-0 transition-opacity duration-200 group-hover:opacity-100"
        />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex h-[62px] w-full cursor-pointer flex-col justify-center gap-0.5 overflow-hidden",
        "rounded-[8px] px-2.5 py-1.5 text-left transition-transform duration-200 hover:scale-[1.02]",
      )}
      style={{
        backgroundColor: `${slot.color}1a`,
        borderLeft: `3px solid ${slot.color}`,
      }}
    >
      <span className="truncate text-[13px] font-medium leading-tight text-ink">
        {slot.subject}
      </span>
      <span className="tabular truncate text-[10px] leading-tight text-ink-muted">
        {time.start}–{time.end}
        {slot.room ? ` · ${slot.room}` : ""}
      </span>
    </button>
  );
}
