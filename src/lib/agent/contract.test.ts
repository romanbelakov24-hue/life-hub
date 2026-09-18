import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { applyPriority, flagsToPriority, priorityToFlags } from "./contract";

const QUADRANTS = [
  { urgent: true, important: true },
  { urgent: true, important: false },
  { urgent: false, important: true },
  { urgent: false, important: false },
];

describe("приоритет агента", () => {
  it("P1/P2/P3 раскладываются на флаги и собираются обратно", () => {
    for (const priority of ["P1", "P2", "P3"] as const) {
      const flags = priorityToFlags(priority);
      assert.equal(flagsToPriority(flags.urgent, flags.important), priority);
    }
  });

  it("приоритет, отправленный обратно без изменений, не двигает задачу по матрице", () => {
    for (const current of QUADRANTS) {
      const echoed = flagsToPriority(current.urgent, current.important);
      assert.deepEqual(applyPriority(current, echoed), current);
    }
  });

  it("новый приоритет меняет флаги", () => {
    assert.deepEqual(applyPriority({ urgent: true, important: false }, "P3"), {
      urgent: false,
      important: false,
    });
    assert.deepEqual(applyPriority({ urgent: false, important: false }, "P1"), {
      urgent: true,
      important: true,
    });
  });

  it("без приоритета флаги остаются как были", () => {
    assert.deepEqual(applyPriority({ urgent: true, important: false }, undefined), {
      urgent: true,
      important: false,
    });
  });
});
