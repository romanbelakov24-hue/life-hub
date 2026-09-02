import type { Metadata } from "next";
import { headers } from "next/headers";

import { PageHeader } from "@/components/layout/app-shell";
import { CalendarFeed } from "@/components/settings/calendar-feed";
import { ShareControl } from "@/components/settings/share-control";
import {
  getOrCreateCalendarToken,
  getOrCreateShareToken,
  isShareEnabled,
} from "@/lib/queries/settings";

/**
 * Настройки.
 *
 * Раздела нет в нижней навигации — там ровно пять пунктов, и шестой сделал бы
 * цели касания слишком тесными. Сюда ведёт шестерёнка в шапке на телефоне и в
 * подвале сайдбара на компьютере.
 */

export const metadata: Metadata = { title: "Настройки" };

export const dynamic = "force-dynamic";

/**
 * Собирает абсолютный адрес ленты из заголовков запроса.
 *
 * Хардкодить домен нельзя: он разный у локальной разработки, превью-деплоя и
 * продакшна. За прокси Netlify оригинальная схема приезжает в
 * `x-forwarded-proto` — без неё на проде получился бы http-адрес.
 */
async function resolveOrigin(): Promise<string> {
  const headerList = await headers();

  const host = headerList.get("host") ?? "localhost:3000";
  const protocol =
    headerList.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");

  return `${protocol}://${host}`;
}

export default async function SettingsPage() {
  const [origin, calendarToken, shareToken, shareEnabled] = await Promise.all([
    resolveOrigin(),
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
