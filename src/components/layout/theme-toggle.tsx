"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

import { cn } from "@/lib/utils/cn";

/**
 * Переключатель темы: система / светлая / тёмная.
 *
 * До монтирования на клиенте реальная тема неизвестна (сервер не знает
 * настройку устройства), поэтому рисуем скелет-заглушку тех же размеров —
 * так не будет ни мигания неправильной иконки, ни сдвига вёрстки.
 */

const OPTIONS = [
  { value: "system", label: "Системная", icon: Monitor },
  { value: "light", label: "Светлая", icon: Sun },
  { value: "dark", label: "Тёмная", icon: Moon },
] as const;

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return <div className={cn("h-9 w-[104px] rounded-full bg-surface-2", className)} />;
  }

  return (
    <div
      role="radiogroup"
      aria-label="Тема оформления"
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full border border-line bg-surface-2 p-0.5",
        className,
      )}
    >
      {OPTIONS.map((option) => {
        const Icon = option.icon;
        const isActive = theme === option.value;

        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={isActive}
            aria-label={option.label}
            title={option.label}
            onClick={() => setTheme(option.value)}
            className={cn(
              "flex h-8 w-8 cursor-pointer items-center justify-center rounded-full",
              "transition-[background-color,color] duration-200",
              isActive
                ? "bg-surface text-ink shadow-[0_1px_2px_rgb(0_0_0/0.08)]"
                : "text-ink-faint hover:text-ink",
            )}
          >
            <Icon size={15} />
          </button>
        );
      })}
    </div>
  );
}
