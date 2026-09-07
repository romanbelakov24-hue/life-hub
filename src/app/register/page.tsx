import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AuthShell } from "@/components/auth/auth-shell";
import { RegisterForm } from "@/components/auth/register-form";
import { getCurrentUser } from "@/lib/auth/user";

/** Регистрация. Лежит вне группы `(app)` — см. комментарий в app/login/page.tsx. */

export const metadata: Metadata = { title: "Регистрация" };

export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  const user = await getCurrentUser();
  if (user) redirect("/");

  return (
    <AuthShell title="Регистрация" description="Личный трекер расходов и учебный планер">
      <RegisterForm />
    </AuthShell>
  );
}
