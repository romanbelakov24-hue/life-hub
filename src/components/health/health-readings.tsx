import { Footprints, HeartPulse, Moon, Smartphone } from "lucide-react";

import { Metric } from "@/components/ui/misc";
import { Panel, PanelHeader } from "@/components/ui/panel";
import type { HealthDaily } from "@/lib/types";
import { formatDayMonthShort } from "@/lib/utils/date";
import { formatNumber } from "@/lib/utils/format";

/**
 * Показатели здоровья: последние значения + ритм шагов и экранного времени
 * за две недели.
 *
 * Компонент серверный — данные уже пришли готовыми со страницы, здесь нет
 * ни состояния, ни обработчиков.
 */

interface HealthReadingsProps {
  latest: HealthDaily | null;
  /** Последние 14 дней по порядку возрастания даты — для полос ритма. */
  recent: HealthDaily[];
}

export function HealthReadings({ latest, recent }: HealthReadingsProps) {
  const maxSteps = Math.max(...recent.map((day) => day.steps ?? 0), 1);
  const maxScreenTime = Math.max(...recent.map((day) => day.screenTimeMinutes ?? 0), 1);

  return (
    <Panel index={1}>
      <PanelHeader
        eyebrow={latest ? `Обновлено ${formatDayMonthShort(latest.date)}` : "Пока нет данных"}
        title="Показатели"
        description={
          latest
            ? undefined
            : "Появятся после первого запуска автоматизации из инструкции выше или ручной записи экранного времени ниже"
        }
      />

      {latest ? (
        <>
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Metric
              label="Шаги"
              value={latest.steps === null ? "—" : formatNumber(latest.steps, 0)}
              suffix={<Footprints size={14} className="text-ink-faint" />}
            />
            <Metric
              label="Сон"
              value={latest.sleepMinutes === null ? "—" : formatDuration(latest.sleepMinutes)}
              suffix={<Moon size={14} className="text-ink-faint" />}
            />
            <Metric
              label="Пульс покоя"
              value={
                latest.restingHeartRate === null ? "—" : `${latest.restingHeartRate}`
              }
              suffix={<HeartPulse size={14} className="text-ink-faint" />}
            />
            <Metric
              label="Экран"
              value={
                latest.screenTimeMinutes === null ? "—" : formatDuration(latest.screenTimeMinutes)
              }
              suffix={<Smartphone size={14} className="text-ink-faint" />}
            />
          </div>

          {recent.some((day) => day.steps !== null) ? (
            <TrendBars label="Шаги за 14 дней" recent={recent} field="steps" max={maxSteps} />
          ) : null}

          {recent.some((day) => day.screenTimeMinutes !== null) ? (
            <TrendBars
              label="Экранное время за 14 дней"
              recent={recent}
              field="screenTimeMinutes"
              max={maxScreenTime}
            />
          ) : null}
        </>
      ) : null}
    </Panel>
  );
}

function TrendBars({
  label,
  recent,
  field,
  max,
}: {
  label: string;
  recent: HealthDaily[];
  field: "steps" | "screenTimeMinutes";
  max: number;
}) {
  return (
    <div className="mt-6 border-t border-line pt-4">
      <p className="eyebrow mb-3">{label}</p>
      <div className="flex h-14 items-end gap-[3px]" aria-hidden>
        {recent.map((day) => {
          const value = day[field];
          return (
            <span
              key={day.date}
              className="flex-1 rounded-t-[2px] bg-accent/70"
              style={{
                height: value && value > 0 ? `${(value / max) * 100}%` : "3px",
                backgroundColor: value ? undefined : "var(--line)",
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

/** 411 -> "6 ч 51 мин" */
function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `${hours} ч ${rest} мин`;
}
