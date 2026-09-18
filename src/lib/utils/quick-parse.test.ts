import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { DEFAULT_CATEGORIES } from "@/lib/db/schema";
import type { Category } from "@/lib/types";

import { parseQuickEntry } from "./quick-parse";

const categories: Category[] = DEFAULT_CATEGORIES.map((category) => ({
  id: category.id,
  name: category.name,
  color: category.color,
  icon: category.icon,
  isDefault: true,
  sortOrder: category.sortOrder,
  monthlyLimit: null,
}));

describe("быстрое добавление траты", () => {
  it("«Магазин — 1200»: сумма, заметка и категория по названию", () => {
    const result = parseQuickEntry("Магазин — 1200", categories);
    assert.equal(result.amount, 1200);
    assert.equal(result.note, "Магазин");
    assert.equal(result.categoryId, "cat_groceries");
  });

  it("«1250,50 продукты»: дробная сумма с запятой впереди", () => {
    const result = parseQuickEntry("1250,50 продукты", categories);
    assert.equal(result.amount, 1250.5);
    assert.equal(result.note, "продукты");
    assert.equal(result.categoryId, "cat_groceries");
  });

  it("«500»: только сумма, категорию выбирает пользователь", () => {
    const result = parseQuickEntry("500", categories);
    assert.equal(result.amount, 500);
    assert.equal(result.categoryId, null);
  });

  it("без числа суммы нет", () => {
    assert.equal(parseQuickEntry("просто текст", categories).amount, null);
  });
});
