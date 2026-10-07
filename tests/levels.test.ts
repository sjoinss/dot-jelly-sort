import { test } from "node:test";
import assert from "node:assert/strict";
import { STAGE } from "../src/config/stage";
import { generateLevel, hiddenChance, solve, stageParams } from "../src/game/levels";
import { applyMove, createGame, isSolved } from "../src/game/rules";

test("같은 스테이지는 늘 같은 레벨 (시드 결정적)", () => {
  for (const s of [1, 17, 50, 51, 123]) {
    const a = generateLevel(s);
    const b = JSON.parse(JSON.stringify(a));
    assert.deepEqual(generateLevel(s), b);
    assert.deepEqual(stageParams(s), stageParams(s));
  }
});

test("1~150 스테이지: 모양(가득 찬 병 + 빈 병 2개)과 종류별 개수, 풀이로 실제 클리어", () => {
  for (let s = 1; s <= 150; s++) {
    const lv = generateLevel(s);
    assert.equal(lv.bottles.length, lv.types + lv.empty, `stage ${s}`);
    const counts = new Map<number, number>();
    for (const b of lv.bottles) {
      assert.ok(b.length === 0 || b.length === lv.capacity, `stage ${s}: 병은 가득 차거나 비어 있음`);
      for (const t of b) counts.set(t, (counts.get(t) ?? 0) + 1);
    }
    assert.equal(counts.size, lv.types);
    for (const n of counts.values()) assert.equal(n, lv.capacity);
    // 시작부터 다 맞춘 병은 없다
    assert.ok(lv.bottles.every((b) => b.length === 0 || !b.every((t) => t === b[0])), `stage ${s}: 이미 정렬된 병`);

    // 풀이기가 찾은 순서대로 실제 규칙으로 옮기면 클리어된다
    const plan = solve(lv.bottles, lv.capacity)!;
    assert.ok(plan, `stage ${s}: 풀이 없음`);
    let g = createGame(lv.bottles, lv.capacity, lv.hidden);
    for (const [f, t] of plan) {
      const r = applyMove(g, f, t);
      assert.ok(r, `stage ${s}: 규칙에 맞지 않는 이동 ${f}→${t}`);
      g = r.state;
    }
    assert.ok(isSolved(g), `stage ${s}: 풀이 후 클리어 아님`);
    assert.equal(plan.length, lv.par);
  }
});

test("난이도: 일반 스테이지는 3종류에서 12종류까지 점진, 무한 모드는 11종류 이상", () => {
  assert.equal(stageParams(1).types, 3);
  assert.equal(stageParams(STAGE.FINITE_STAGE_COUNT).types, 12);
  let prev = 0;
  for (let s = 1; s <= STAGE.FINITE_STAGE_COUNT; s++) {
    const t = stageParams(s).types;
    assert.ok(t >= prev);
    prev = t;
  }
  for (let s = 51; s <= 400; s++) {
    const p = stageParams(s);
    assert.ok(p.infinite && p.types >= 11 && p.types <= STAGE.INFINITE_TYPES_MAX, `stage ${s}`);
  }
});

test("가림: 일반 스테이지는 정해진 번호, 무한 모드는 10% → 최대 20%", () => {
  for (let s = 1; s <= STAGE.FINITE_STAGE_COUNT; s++) assert.equal(stageParams(s).hidden, STAGE.HIDDEN_STAGES.includes(s));
  assert.equal(hiddenChance(51), 0.1);
  assert.ok(hiddenChance(200) <= 0.2 + 1e-9);
  assert.equal(hiddenChance(100_000), 0.2);
  let hidden = 0;
  const N = 3000;
  for (let s = 1001; s < 1001 + N; s++) if (stageParams(s).hidden) hidden++;
  const rate = hidden / N;
  assert.ok(rate > 0.16 && rate < 0.24, `무한 후반 가림 비율 ${rate}`);
});
