import type { Metadata } from "next";

import { PageHeader } from "@/components/layout/app-shell";
import { AccountPanel } from "@/components/settings/account-panel";
import { AgentAccess } from "@/components/settings/agent-access";
import { CalendarFeed } from "@/components/settings/calendar-feed";
import { ShareControl } from "@/components/settings/share-control";
import { TelegramBot } from "@/components/settings/telegram-bot";
import { requireUser } from "@/lib/auth/user";
import {
  getOrCreateCalendarToken,
  getOrCreateShareToken,
  hasAgentToken,
  isShareEnabled,
} from "@/lib/queries/settings";
import { loadTelegramPanel } from "@/lib/telegram/panel";
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
  const user = await requireUser();

  const [origin, calendarToken, shareToken, shareEnabled, agentEnabled, telegram] = await Promise.all([
    resolveSiteOrigin(),
    getOrCreateCalendarToken(user.id),
    getOrCreateShareToken(user.id),
    isShareEnabled(user.id),
    hasAgentToken(user.id),
    loadTelegramPanel(user.id),
  ]);

  return (
    <>
      <PageHeader
        eyebrow="Система"
        title="Настройки"
        description="Интеграции и параметры приложения"
      />

      <div className="flex flex-col gap-4">
        <AccountPanel email={user.email} name={user.name} index={0} />
        <TelegramBot initial={telegram} index={1} />
        <CalendarFeed feedUrl={`${origin}/api/calendar/${calendarToken}.ics`} index={2} />
        <ShareControl shareUrl={`${origin}/s/${shareToken}`} enabled={shareEnabled} index={3} />
        <AgentAccess apiBase={`${origin}/api/agent`} enabled={agentEnabled} index={4} />
      </div>
    </>
  );
}
