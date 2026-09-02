import type { Metadata } from "next";
import { headers } from "next/headers";

import { PageHeader } from "@/components/layout/app-shell";
import { CalendarFeed } from "@/components/settings/calendar-feed";
import { getOrCreateCalendarToken } from "@/lib/queries/settings";

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
async function resolveFeedUrl(token: string): Promise<string> {
  const headerList = await headers();

  const host = headerList.get("host") ?? "localhost:3000";
  const protocol =
    headerList.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");

  return `${protocol}://${host}/api/calendar/${token}.ics`;
}

export default async function SettingsPage() {
  const token = await getOrCreateCalendarToken();
  const feedUrl = await resolveFeedUrl(token);

  return (
    <>
      <PageHeader
        eyebrow="Система"
        title="Настройки"
        description="Интеграции и параметры приложения"
      />

      <div className="flex flex-col gap-4">
        <CalendarFeed feedUrl={feedUrl} />
      </div>
    </>
  );
}
