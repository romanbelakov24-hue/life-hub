import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, Unbounded } from "next/font/google";

import { AmbientGlow } from "@/components/layout/ambient-glow";
import { AppShell } from "@/components/layout/app-shell";
import { ThemeProvider } from "@/components/layout/theme-provider";

import "./globals.css";

/**
 * Корневой layout.
 *
 * Тройка шрифтов, каждый со своей ролью:
 *   Unbounded      — крупные заголовки и логотип. Намеренно характерный
 *                    гротеск с полноценной кириллицей; используется только
 *                    на больших кеглях, где его рисунок читается как приём,
 *                    а не мешает чтению;
 *   Inter          — интерфейсный текст и подписи (максимальная читаемость);
 *   JetBrains Mono — все цифры (моноширинные, колонки сумм не «прыгают»).
 * Подключаются через next/font: файлы отдаются с нашего домена, без запроса
 * к Google на стороне пользователя и без скачка вёрстки при загрузке.
 */

const unbounded = Unbounded({
  subsets: ["latin", "cyrillic"],
  weight: ["500", "600", "700"],
  variable: "--font-unbounded",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "life hub — расходы и учёба",
    template: "%s · life hub",
  },
  description: "Личный трекер расходов и учебный планер",
  applicationName: "life hub",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // maximumScale не ограничиваем: запрет зума ломает доступность.
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbf9f5" },
    { media: "(prefers-color-scheme: dark)", color: "#0d0c0b" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning нужен next-themes: класс темы ставится скриптом
    // до гидрации, и разметка сервера намеренно отличается от клиентской.
    <html
      lang="ru"
      suppressHydrationWarning
      className={`${unbounded.variable} ${inter.variable} ${jetbrainsMono.variable}`}
    >
      <body>
        <ThemeProvider>
          {/* Свечение лежит ниже каркаса (у него z-10) и ничего не перехватывает. */}
          <AmbientGlow />
          <AppShell>{children}</AppShell>
        </ThemeProvider>
      </body>
    </html>
  );
}
