import type { Metadata } from "next";
import { Activity, Footprints, HeartPulse, Moon, Smartphone } from "lucide-react";

import { PageHeader } from "@/components/layout/app-shell";
import { Panel, PanelHeader } from "@/components/ui/panel";

/**
 * Раздел «Здоровье» — заготовка.
 *
 * Пустая страница выглядела бы поломкой, поэтому здесь честно написано, что
 * раздел ещё не наполнен, и из чего он будет собран. Так же зафиксировано
 * главное ограничение: у Apple Health и Xiaomi Health нет веб-интерфейса, и
 * данные придётся забирать либо из приложения, либо через «Быстрые команды».
 */

export const metadata: Metadata = { title: "Здоровье" };

const PLANNED = [
  {
    icon: Footprints,
    title: "Шаги и активность",
    description: "Дневная норма и то, как она держится по неделям.",
  },
  {
    icon: Moon,
    title: "Сон",
    description: "Длительность и время отхода ко сну рядом с расписанием пар.",
  },
  {
    icon: HeartPulse,
    title: "Пульс",
    description: "Пульс покоя как признак усталости в сессию.",
  },
];

export default function HealthPage() {
  return (
    <>
      <PageHeader
        eyebrow="Здоровье"
        title="Здоровье"
        description="Раздел в работе — пока здесь план, а не данные"
      />

      <div className="flex flex-col gap-4">
        <Panel index={0}>
          <PanelHeader
            eyebrow="Что будет"
            title="Показатели"
            description="Появятся, как только будет откуда их брать"
          />

          <ul className="mt-4 flex flex-col gap-3">
            {PLANNED.map((item) => {
              const Icon = item.icon;

              return (
                <li
                  key={item.title}
                  className="flex items-start gap-3 rounded-[12px] border border-dashed border-line px-3.5 py-3"
                >
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-surface-2 text-ink-faint">
                    <Icon size={17} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink">{item.title}</p>
                    <p className="mt-0.5 text-[13px] leading-snug text-ink-muted">
                      {item.description}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </Panel>

        <Panel index={1}>
          <PanelHeader
            eyebrow="Ограничение"
            title="Откуда возьмутся данные"
            description="Об этом стоит знать заранее — оно определяет сроки"
          />

          <div className="mt-4 flex flex-col gap-3 text-[13px] leading-relaxed text-ink-muted">
            <p className="flex items-start gap-2.5">
              <Smartphone size={15} className="mt-0.5 shrink-0 text-ink-faint" />
              У Apple Health и Xiaomi Health нет веб-интерфейса: сайт не может
              прочитать их данные ни при каких настройках. Это ограничение
              платформ, а не приложения.
            </p>
            <p className="flex items-start gap-2.5">
              <Activity size={15} className="mt-0.5 shrink-0 text-ink-faint" />
              Рабочих путей два: мобильное приложение с доступом к Health
              Connect на Android — либо автоматизация в «Быстрых командах»,
              которая раз в день отправляет показатели сюда. Второй способ
              работает уже сегодня и не требует нативного кода.
            </p>
          </div>
        </Panel>
      </div>
    </>
  );
}
