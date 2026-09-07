"use client";

import { LogOut, User } from "lucide-react";
import { useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { logoutAction } from "@/lib/actions/auth";

/** Кто вошёл и кнопка выхода. Первая панель в настройках — остальное про сайт. */

interface AccountPanelProps {
  email: string;
  name: string;
  index?: number;
}

export function AccountPanel({ email, name, index }: AccountPanelProps) {
  const [isPending, startTransition] = useTransition();

  function handleLogout() {
    startTransition(async () => {
      await logoutAction();
    });
  }

  return (
    <Panel index={index}>
      <PanelHeader
        eyebrow="Аккаунт"
        title={name || email}
        description={name ? email : "Личный аккаунт life hub"}
        actions={
          <Button onClick={handleLogout} variant="outline" size="sm" disabled={isPending}>
            <LogOut size={14} />
            Выйти
          </Button>
        }
      />

      <p className="mt-4 flex items-start gap-2.5 text-[13px] leading-relaxed text-ink-muted">
        <User size={15} className="mt-0.5 shrink-0 text-ink-faint" />
        Все траты, расписание, задачи и заметки видны только на этом аккаунте.
      </p>
    </Panel>
  );
}
