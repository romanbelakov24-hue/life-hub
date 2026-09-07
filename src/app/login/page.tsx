import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";
import { getCurrentUser } from "@/lib/auth/user";

/**
 * Вход. Лежит вне группы `(app)`: у неё своя, отдельная от AppShell, разметка,
 * и её единственная задача — привести к сессии, откуда уже начинается всё
 * остальное.
 */

export const metadata: Metadata = { title: "Вход" };

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  // Уже вошедшему тут делать нечего — скорее всего, перешёл по старой ссылке.
  const user = await getCurrentUser();
  if (user) redirect("/");

  return (
    <AuthShell title="Вход" description="Личный трекер расходов и учебный планер">
      <LoginForm />
    </AuthShell>
  );
}
