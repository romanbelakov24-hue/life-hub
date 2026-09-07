import "server-only";

import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

/**
 * Хеширование паролей — scrypt из стандартной библиотеки Node, без внешних
 * зависимостей (тот же принцип, что и остальной проект: свой safeEqual вместо
 * готовой crypto-библиотеки, свой CountUp вместо анимационного фреймворка).
 *
 * scrypt, а не просто sha256 — он намеренно медленный и требователен к памяти,
 * так что перебор пароля из утёкшей базы стоит на порядки дороже, чем один
 * хеш. Соль своя на каждый пароль — одинаковые пароли дают разные хеши, и
 * заранее посчитанные радужные таблицы бесполезны.
 */

const scryptAsync = promisify(scrypt);

const KEY_LENGTH = 64;
const SALT_BYTES = 16;

/** `<соль-hex>:<хеш-hex>` — одна строка, ничего лишнего в схеме таблицы. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const derived = (await scryptAsync(password, salt, KEY_LENGTH)) as Buffer;
  return `${salt.toString("hex")}:${derived.toString("hex")}`;
}

/** Сравнение за постоянное время — не даёт узнать длину совпавшего префикса. */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex) return false;

  const salt = Buffer.from(saltHex, "hex");
  const expected = Buffer.from(hashHex, "hex");
  if (expected.length !== KEY_LENGTH) return false;

  const derived = (await scryptAsync(password, salt, KEY_LENGTH)) as Buffer;
  return timingSafeEqual(derived, expected);
}
