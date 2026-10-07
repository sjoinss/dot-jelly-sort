import { test } from "node:test";
import assert from "node:assert/strict";
import { addSpareBottle, applyMove, capacityOf, createGame, isSolved, isStuck, moveCount, resetGame, starsFor, topRun, undo } from "../src/game/rules";

const ids = (g: ReturnType<typeof createGame>) => g.bottles.map((b) => b.map((c) => c.typeId));

test("이동: 맨 위 같은 종류 덩어리 전체를, 빈칸이 모자라면 들어가는 만큼만", () => {
  const g = createGame([[0, 1, 1, 1], [2, 1], []], 4, false);
  assert.equal(topRun(g.bottles[0]), 3);
  assert.equal(moveCount(g, 0, 1), 2, "빈칸 2개만큼");
  const r = applyMove(g, 0, 1)!;
  assert.deepEqual(ids(r.state), [[0, 1], [2, 1, 1, 1], []]);
  assert.equal(r.move.count, 2);
  assert.equal(r.state.moves, 1);
  assert.equal(moveCount(g, 0, 2), 3, "빈 병에는 덩어리 전체");
});

test("이동 불가: 맨 위 종류가 다름, 가득 참, 빈 병에서, 같은 병", () => {
  const g = createGame([[0, 1], [0, 2], [3, 3, 3, 3], []], 4, false);
  assert.equal(moveCount(g, 0, 1), 0);
  assert.equal(moveCount(g, 0, 2), 0);
  assert.equal(moveCount(g, 3, 0), 0);
  assert.equal(moveCount(g, 0, 0), 0);
  assert.equal(applyMove(g, 0, 1), null);
});

test("클리어: 모든 병이 비었거나 한 종류로 가득", () => {
  assert.ok(isSolved(createGame([[1, 1, 1, 1], [], [0, 0, 0, 0]], 4, false)));
  assert.ok(!isSolved(createGame([[1, 1, 1], [1], [0, 0, 0, 0]], 4, false)), "덜 찬 병");
  assert.ok(!isSolved(createGame([[1, 1, 1, 0], [0, 0, 0, 1]], 4, false)));
});

test("되돌리기: 한 판 3번까지, 다시하기하면 3번으로", () => {
  let g = createGame([[0, 1], [1, 0], [], []], 4, false);
  for (const [f, t] of [[0, 2], [1, 3], [0, 3], [1, 2]] as const) g = applyMove(g, f, t)!.state;
  assert.equal(g.moves, 4);
  assert.equal(g.history.length, 3, "기록은 최대 3개");
  for (let i = 0; i < 3; i++) g = undo(g)!;
  assert.equal(g.undoLeft, 0);
  assert.equal(g.moves, 1);
  assert.equal(undo(g), null, "4번째는 안 됨");
  const fresh = resetGame(createGame([[0, 1], [1, 0], [], []], 4, false));
  assert.equal(fresh.undoLeft, 3);
  assert.equal(fresh.moves, 0);
});

test("가림: 맨 위만 보이고, 드러난 블록은 되돌려도 계속 보인다", () => {
  let g = createGame([[0, 1, 2], [], []], 4, true);
  assert.deepEqual(g.bottles[0].map((c) => c.revealed), [false, false, true]);
  g = applyMove(g, 0, 1)!.state;
  assert.deepEqual(g.bottles[0].map((c) => c.revealed), [false, true], "새 맨 위 공개");
  g = undo(g)!;
  assert.deepEqual(g.bottles[0].map((c) => c.revealed), [false, true, true], "공개 상태 유지");
});

test("가림: 맨 위와 같은 종류가 바로 아래 이어져 있으면 덩어리 전체가 보인다", () => {
  let g = createGame([[0, 1, 2, 2], [3, 1, 1, 1], []], 4, true);
  assert.deepEqual(g.bottles[0].map((c) => c.revealed), [false, false, true, true]);
  assert.deepEqual(g.bottles[1].map((c) => c.revealed), [false, true, true, true]);
  g = applyMove(g, 0, 2)!.state;
  assert.deepEqual(g.bottles[0].map((c) => c.revealed), [false, true], "옮긴 뒤 새 맨 위 덩어리 공개");
});

test("막힘 감지: 쓸모 있는 이동이 없을 때만", () => {
  assert.ok(isStuck(createGame([[0, 1, 0, 1], [1, 0, 1, 0]], 4, false)));
  assert.ok(!isStuck(createGame([[0, 1, 0, 1], [1, 0, 1, 0], []], 4, false)));
  // 한 종류뿐인 병을 빈 병으로 옮기는 것(제자리걸음)만 남았으면 막힌 것
  assert.ok(isStuck(createGame([[0, 0], [1, 1, 1, 1], []], 4, false)));
});

test("별: 기준 이동 수 대비", () => {
  assert.equal(starsFor(10, 10), 3);
  assert.equal(starsFor(14, 10), 2);
  assert.equal(starsFor(30, 10), 1);
});

test("여분 병: 1칸, 몇 번이든, 이동으로 세지 않고, 되돌려도 남고, 다시하기하면 사라진다", () => {
  const start = createGame([[0, 1, 0, 1], [1, 0, 1, 0]], 4, false);
  assert.ok(isStuck(start));
  let g = addSpareBottle(addSpareBottle(start));
  assert.equal(g.bottles.length, 4);
  assert.equal(capacityOf(g, 2), 1);
  assert.equal(g.moves, 0);
  assert.ok(!isStuck(g));
  assert.equal(moveCount(g, 0, 2), 1, "1칸만 들어감");
  g = applyMove(g, 0, 2)!.state;
  assert.equal(moveCount(g, 1, 2), 0, "가득 찬 여분 병");
  g = undo(g)!;
  assert.equal(g.bottles.length, 4, "되돌려도 여분 병은 남음");
  assert.deepEqual(g.bottles[2], []);
  // 여분 병에 블록이 남아 있으면 클리어가 아니다
  const solvedButSpare = addSpareBottle(createGame([[0, 0, 0], [1, 1, 1, 1]], 4, false));
  const moved = applyMove(solvedButSpare, 0, 2)!.state;
  assert.ok(!isSolved(moved));
  assert.equal(resetGame(start).bottles.length, 2, "다시하기는 처음 상태");
});
