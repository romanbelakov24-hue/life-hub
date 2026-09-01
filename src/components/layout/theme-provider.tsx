"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ReactNode } from "react";

/**
 * Провайдер тем.
 *
 * `attribute="class"` вешает класс .dark на <html> — именно его слушает
 * @custom-variant dark в globals.css. `defaultTheme="system"` означает, что до
 * первого явного выбора приложение следует настройке телефона или ноутбука.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
