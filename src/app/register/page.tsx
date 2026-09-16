import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AuthShell } from "@/components/auth/auth-shell";
import { RegisterForm } from "@/components/auth/register-form";
import { getCurrentUser } from "@/lib/auth/user";
import { isRegistrationOpen } from "@/lib/queries/users";

/** Регистрация. Лежит вне группы `(app)` — см. комментарий в app/login/page.tsx. */

export const metadata: Metadata = { title: "Регистрация" };

export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  const user = await getCurrentUser();
  if (user) redirect("/");

  if (!(await isRegistrationOpen())) {
    return (
      <AuthShell title="Регистрация закрыта" description="Новые аккаунты здесь не создаются">
        <p className="text-center text-[13px] leading-relaxed text-ink-muted">
          Это личное приложение.{" "}
          <Link href="/login" className="font-medium text-accent hover:underline">
            Войти
          </Link>
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Регистрация" description="Личный трекер расходов и учебный планер">
      <RegisterForm />
    </AuthShell>
  );
}
