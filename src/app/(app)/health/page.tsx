import type { Metadata } from "next";
import { Rocket } from "lucide-react";

import { PageHeader } from "@/components/layout/app-shell";
import { HealthExport } from "@/components/health/health-export";
import { HealthReadings } from "@/components/health/health-readings";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { getLatestHealth, listHealthInRange } from "@/lib/queries/health";
import { getOrCreateHealthToken } from "@/lib/queries/settings";
import { addDays, todayIso } from "@/lib/utils/date";
import { resolveSiteOrigin } from "@/lib/utils/origin";

/**
 * Раздел «Здоровье».
 *
 * У Apple Health и Xiaomi Health нет веб-API — сайт физически не может
 * прочитать их данные напрямую. Мост здесь: автоматизация «Быстрых команд»
 * на iPhone сама читает Здоровье и раз в день шлёт сюда то, что нашла (см.
 * HealthExport и приёмник src/app/api/health/[token]/route.ts). Данные
 * приходят с задержкой в сутки и по тем показателям, что настроит владелец, —
 * это менее полная картина, чем родное приложение Здоровье, но она уже
 * реальные данные, а не заглушка.
 */

export const metadata: Metadata = { title: "Здоровье" };

export const dynamic = "force-dynamic";

export default async function HealthPage() {
  const today = todayIso();
  const twoWeeksAgo = addDays(today, -13);

  const [origin, token, latest, recentRaw] = await Promise.all([
    resolveSiteOrigin(),
    getOrCreateHealthToken(),
    getLatestHealth(),
    listHealthInRange(twoWeeksAgo, today),
  ]);

  // Дни без записи оставляем в ряду нулевыми — иначе полосы «съезжают»
  // и график врёт про регулярность.
  const byDate = new Map(recentRaw.map((day) => [day.date, day]));
  const recent = Array.from({ length: 14 }, (_, index) => {
    const date = addDays(twoWeeksAgo, index);
    return byDate.get(date) ?? { date, steps: null, sleepMinutes: null, restingHeartRate: null, updatedAt: "" };
  });

  return (
    <>
      <PageHeader
        eyebrow="Здоровье"
        title="Здоровье"
        description={
          latest
            ? "Данные приходят из автоматизации на телефоне"
            : "Настройте приём данных ниже — раздел развивается дальше"
        }
      />

      <div className="flex flex-col gap-4">
        <HealthExport webhookUrl={`${origin}/api/health/${token}`} />
        <HealthReadings latest={latest} recent={recent} />

        <Panel index={2}>
          <PanelHeader
            eyebrow="Дальше"
            title="Что ещё в планах"
            description="Раздел продолжит расти по мере того, что окажется полезным"
          />
          <p className="mt-4 flex items-start gap-2.5 text-[13px] leading-relaxed text-ink-muted">
            <Rocket size={15} className="mt-0.5 shrink-0 text-ink-faint" />
            Пульс и сон рядом с расписанием пар, недельные тренды вместо
            дневных цифр, а на Android — приём через Health Connect, когда
            появится собственное приложение.
          </p>
        </Panel>
      </div>
    </>
  );
}
