"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Field, TextInput } from "@/components/ui/field";
import { registerAction } from "@/lib/actions/auth";

/**
 * Форма регистрации.
 *
 * Поле «website» — honeypot: спрятано от людей оффскрин-позиционированием
 * (не display:none — его некоторые эвристики ботов и так игнорируют) и
 * помечено autoComplete="off" и tabIndex={-1}, чтобы ни клавиатурная
 * навигация, ни автозаполнение браузера туда не попадали. Реальный человек
 * его никогда не увидит и не заполнит — бот, слепо заполняющий все поля
 * формы, заполнит, и его тихо отбрасывают в registerAction.
 */
export function RegisterForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [website, setWebsite] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = await registerAction({ email, password, name, honeypot: website });

      // При успехе действие само делает redirect("/") — сюда возвращается
      // управление только при ошибке.
      if (!result.ok) setError(result.error);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div aria-hidden style={{ position: "absolute", left: "-9999px", top: "-9999px" }}>
        <label htmlFor="website">Оставьте это поле пустым</label>
        <input
          id="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={website}
          onChange={(event) => setWebsite(event.target.value)}
        />
      </div>

      <Field label="Имя" hint="Необязательно">
        {(id) => (
          <TextInput
            id={id}
            type="text"
            autoComplete="name"
            maxLength={80}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        )}
      </Field>

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

      <Field label="Пароль" hint="Не короче 8 символов">
        {(id) => (
          <TextInput
            id={id}
            type="password"
            autoComplete="new-password"
            minLength={8}
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
        {isPending ? "Создаём аккаунт…" : "Создать аккаунт"}
      </Button>

      <p className="text-center text-[13px] text-ink-muted">
        Уже есть аккаунт?{" "}
        <Link href="/login" className="font-medium text-accent hover:underline">
          Войти
        </Link>
      </p>
    </form>
  );
}
