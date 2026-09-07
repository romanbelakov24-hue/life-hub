import type { Metadata } from "next";

import { PageHeader } from "@/components/layout/app-shell";
import { CalendarFeed } from "@/components/settings/calendar-feed";
import { ShareControl } from "@/components/settings/share-control";
import {
  getOrCreateCalendarToken,
  getOrCreateShareToken,
  isShareEnabled,
} from "@/lib/queries/settings";
import { resolveSiteOrigin } from "@/lib/utils/origin";

/**
 * Настройки.
 *
 * Раздела нет в нижней навигации — там ровно пять пунктов, и шестой сделал бы
 * цели касания слишком тесными. Сюда ведёт шестерёнка в шапке на телефоне и в
 * подвале сайдбара на компьютере.
 */

export const metadata: Metadata = { title: "Настройки" };

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const [origin, calendarToken, shareToken, shareEnabled] = await Promise.all([
    resolveSiteOrigin(),
    getOrCreateCalendarToken(),
    getOrCreateShareToken(),
    isShareEnabled(),
  ]);

  return (
    <>
      <PageHeader
        eyebrow="Система"
        title="Настройки"
        description="Интеграции и параметры приложения"
      />

      <div className="flex flex-col gap-4">
        <CalendarFeed feedUrl={`${origin}/api/calendar/${calendarToken}.ics`} />
        <ShareControl shareUrl={`${origin}/s/${shareToken}`} enabled={shareEnabled} />
      </div>
    </>
  );
}
