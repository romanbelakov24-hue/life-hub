"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Field, TextInput } from "@/components/ui/field";
import { loginAction } from "@/lib/actions/auth";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = await loginAction({ email, password });

      // При успехе действие само делает redirect("/") — сюда возвращается
      // управление только при ошибке.
      if (!result.ok) setError(result.error);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Field label="Email">
        {(id) => (
          <TextInput
            id={id}
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        )}
      </Field>

      <Field label="Пароль">
        {(id) => (
          <TextInput
            id={id}
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        )}
      </Field>

      {error ? (
        <p className="text-[12px] text-negative" role="alert">
          {error}
        </p>
      ) : null}

      <Button type="submit" variant="primary" disabled={isPending} className="mt-1 w-full">
        {isPending ? "Входим…" : "Войти"}
      </Button>

      <p className="text-center text-[13px] text-ink-muted">
        Ещё нет аккаунта?{" "}
        <Link href="/register" className="font-medium text-accent hover:underline">
          Создать
        </Link>
      </p>
    </form>
  );
}
