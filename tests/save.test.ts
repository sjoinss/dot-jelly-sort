import { test } from "node:test";
import assert from "node:assert/strict";
import { pushRecent, paint, pick, clearInner } from "../src/editor/jellyEdit";
import { nextStage, recordClear } from "../src/lib/progress";
import { defaultSave, FILE_APP, parseFile, readSave, toFile } from "../src/lib/save";
import { EDITABLE, emptyInner, JELLY_W } from "../src/sprites/jelly";
import { layoutBoard } from "../src/render/layout";

test("저장 읽기: 이상한 값은 기본값으로, 마스크 밖 도트는 버림", () => {
  assert.deepEqual(readSave(null), defaultSave());
  const inner = new Array(16 * 14).fill("#123456");
  const s = readSave({
    settings: { mode: "block", outline: "pink", reduceMotion: "yes", showNumbers: true },
    progress: { stars: { "3": 2, "4": 9, x: 1 }, best: -5 },
    jelly: { base: inner, types: { "2": { mode: "jelly", width: 16, height: 14, bodyColor: "#ABCDEF", inner }, "999": {} }, recentColors: ["#fff", "#aabbcc"] },
    block: { types: { "0": { mode: "block", width: 8, height: 8, inner: new Array(64).fill("#000000"), name: "Steve" } } },
  });
  assert.equal(s.settings.mode, "block");
  assert.equal(s.settings.outline, "black");
  assert.equal(s.settings.reduceMotion, false);
  assert.deepEqual(s.progress, { stars: { "3": 2 }, best: 3 });
  assert.ok(s.jelly.base.every((c, i) => (c !== null) === EDITABLE[i]));
  assert.equal(s.jelly.types["2"].bodyColor, "#abcdef");
  assert.equal(s.jelly.types["999"], undefined);
  assert.deepEqual(s.jelly.recentColors, ["#aabbcc"]);
  assert.equal(s.block.types["0"].name, "Steve");
});

test("JSON 파일: 저장한 것을 그대로 불러온다", () => {
  const save = defaultSave();
  save.jelly.types["1"] = { mode: "jelly", width: 16, height: 14, bodyColor: "#00ff00", inner: emptyInner(), source: "custom" };
  save.block.types["4"] = { mode: "block", width: 8, height: 8, bodyColor: "", inner: new Array(64).fill("#334455"), source: "skin", name: "Alex" };
  const text = JSON.stringify(toFile(save));
  const r = parseFile(text);
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.deepEqual(r.base, save.jelly.base);
  assert.equal(r.jellyTypes["1"].bodyColor, "#00ff00");
  assert.equal(r.blockTypes["4"].name, "Alex");
  assert.equal(r.dropped, 0);
});

test("JSON 파일 오류: 형식·다른 앱·새 버전·빈 파일은 이유와 함께 거절", () => {
  const bad = (t: string) => {
    const r = parseFile(t);
    assert.ok(!r.ok);
    return r.ok ? "" : r.message;
  };
  assert.match(bad("{nope"), /JSON 형식/);
  assert.match(bad(JSON.stringify({ app: "other", kind: "sprites", version: 1 })), /파일이 아니에요/);
  assert.match(bad(JSON.stringify({ app: FILE_APP, kind: "sprites", version: 99 })), /새로운 버전/);
  assert.match(bad(JSON.stringify({ app: FILE_APP, kind: "sprites", version: 1 })), /없어요/);
});

test("진행도: 별은 더 좋을 때만, 플레이는 다음 스테이지", () => {
  let p = recordClear({ stars: {}, best: 0 }, 1, 2);
  p = recordClear(p, 1, 1);
  assert.equal(p.stars["1"], 2);
  assert.equal(nextStage(p), 2);
});

test("에디터: 안쪽만 칠하고, 스포이드는 칠한 색 또는 몸통 색", () => {
  const d = { inner: emptyInner(), body: "#ff0000" };
  assert.equal(paint(d, 0, 0, "#000000"), d, "마스크 밖은 그대로");
  const i = EDITABLE.indexOf(true);
  const x = i % JELLY_W;
  const y = Math.floor(i / JELLY_W);
  const p = paint(d, x, y, "#00ff00");
  assert.equal(pick(p, x, y), "#00ff00");
  assert.equal(pick(d, x, y), "#ff0000");
  assert.equal(pick(d, 0, 0), null);
  assert.ok(clearInner(p).inner.every((c) => c === null));
  assert.deepEqual(pushRecent(["#111111", "#222222"], "#222222"), ["#222222", "#111111"]);
});

test("판 배치: 병이 겹치지 않고 화면 안에, 정수 배율", () => {
  for (const [w, h] of [[720, 1100], [1170, 1700], [360, 560]] as const)
    for (const n of [5, 10, 14, 16]) {
      const l = layoutBoard(w, h, new Array(n).fill(4), 16, 14);
      assert.equal(l.bottles.length, n);
      assert.ok(Number.isInteger(l.scale) && l.scale >= 1);
      for (const b of l.bottles) {
        assert.ok(b.x - l.scale >= 0 && b.x + b.w + l.scale <= w, `가로 ${w}×${h} n=${n}`);
        assert.ok(b.y + b.h <= h, `세로 ${w}×${h} n=${n}`);
      }
      for (let i = 1; i < n; i++) {
        const a = l.bottles[i - 1];
        const b = l.bottles[i];
        if (a.y === b.y) assert.ok(a.x + a.w < b.x);
      }
    }
});

test("판 배치: 여분 병(1칸)은 키가 작고 같은 줄 병과 바닥이 맞는다", () => {
  const l = layoutBoard(720, 1100, [4, 4, 4, 4, 1], 16, 14);
  const spare = l.bottles[4];
  assert.equal(spare.cap, 1);
  for (const b of l.bottles.slice(0, 4)) assert.ok(spare.h < b.h);
  // 같은 줄(바닥이 같은 높이대)에 있는 병과 바닥을 맞춘다
  const sameRow = l.bottles.slice(0, 4).filter((b) => b.y + b.h > spare.y && b.y < spare.y + spare.h);
  assert.ok(sameRow.length > 0);
  for (const b of sameRow) assert.equal(b.y + b.h, spare.y + spare.h);
});
