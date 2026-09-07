"use server";

import { redirect } from "next/navigation";

import { failure, type ActionResult } from "@/lib/actions/types";
import { createSession, destroySession } from "@/lib/auth/session";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { seedCategoriesForUser } from "@/lib/queries/expenses";
import { claimLegacyData, createUser, findUserByEmail, hasAnyUser } from "@/lib/queries/users";
import { createId } from "@/lib/utils/id";

/**
 * Вход и регистрация.
 *
 * Регистрация открытая (без приглашений) — значит, нужна хоть какая-то защита
 * от ботов. Полноценной (капча) пока нет, но honeypot-поле в форме её частично
 * заменяет: реальный человек его не видит и не заполняет, бот, слепо
 * заполняющий все поля формы, — заполняет, и его просто тихо отбрасывают.
 *
 * Без guard() из actions/types.ts: он рассчитан на уже вошедшего пользователя
 * (сам достаёт userId и отказывает без сессии) — а вход и регистрация как раз
 * работают ДО того, как сессия появится.
 */

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

function validateEmail(email: string): string | null {
  if (!EMAIL_PATTERN.test(email)) return "Введите настоящий email.";
  if (email.length > 200) return "Слишком длинный email.";
  return null;
}

function validatePassword(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Пароль короче ${MIN_PASSWORD_LENGTH} символов.`;
  }
  if (password.length > 200) return "Слишком длинный пароль.";
  return null;
}

export interface RegisterInput {
  email: string;
  password: string;
  name: string;
  /** Скрытое от людей поле — заполнено только ботами. */
  honeypot: string;
}

export async function registerAction(input: RegisterInput): Promise<ActionResult<null>> {
  // Бот заполнил невидимое поле — тихо отказываем, не объясняя почему:
  // осмысленная ошибка только подсказала бы, что именно проверять в следующий раз.
  if (input.honeypot.trim() !== "") {
    return failure("Не удалось создать аккаунт.");
  }

  const email = input.email.trim().toLowerCase();
  const emailError = validateEmail(email);
  if (emailError) return failure(emailError);

  const passwordError = validatePassword(input.password);
  if (passwordError) return failure(passwordError);

  try {
    const existing = await findUserByEmail(email);
    if (existing) return failure("Такой email уже зарегистрирован.");

    // Проверяем ДО создания пользователя: как только он появится, hasAnyUser()
    // уже ответит «да», и определить, что это был первый, станет невозможно.
    const isFirstUser = !(await hasAnyUser());

    const userId = createId("user");
    await createUser({
      id: userId,
      email,
      passwordHash: await hashPassword(input.password),
      name: input.name.trim().slice(0, 80),
      createdAt: new Date().toISOString(),
    });

    if (isFirstUser) {
      // Данные, накопленные до многопользовательского режима, принадлежат
      // тому, кто зарегистрировался первым — обычно это владелец сайта.
      await claimLegacyData(userId);
    } else {
      // У всех остальных база пустая — без стартового набора категорий
      // раздел расходов был бы бесполезен с первой секунды.
      await seedCategoriesForUser(userId);
    }

    await createSession(userId);
  } catch (error) {
    console.error("[auth] register", error);
    return failure("Не удалось создать аккаунт. Попробуйте ещё раз.");
  }

  redirect("/");
}

export interface LoginInput {
  email: string;
  password: string;
}

export async function loginAction(input: LoginInput): Promise<ActionResult<null>> {
  const email = input.email.trim().toLowerCase();
  if (!email || !input.password) return failure("Введите email и пароль.");

  let userId: string;
  try {
    const user = await findUserByEmail(email);
    // Один и тот же ответ для «нет такого email» и «неверный пароль» —
    // иначе форма входа выдавала бы, какие email вообще зарегистрированы.
    if (!user || !(await verifyPassword(input.password, user.passwordHash))) {
      return failure("Неверный email или пароль.");
    }
    userId = user.id;
  } catch (error) {
    console.error("[auth] login", error);
    return failure("Не удалось войти. Попробуйте ещё раз.");
  }

  await createSession(userId);
  redirect("/");
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/login");
}
