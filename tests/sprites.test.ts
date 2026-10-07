import { test } from "node:test";
import assert from "node:assert/strict";
import { BLOCK_H, BLOCK_W, blockPixels, defaultFace, generatedFace, skinToFace } from "../src/sprites/block";
import { DEFAULT_SKIN_FACES, faceDots } from "../src/sprites/defaultSkins";
import {
  autoBodyColor,
  clampInner,
  EDITABLE,
  hiddenInner,
  INK,
  JELLY_H,
  JELLY_W,
  jellyPixels,
  MASK,
  NECK_W,
  outlineColor,
  PRESETS,
  VARIANTS,
} from "../src/sprites/jelly";

const colors = { body: "#ff6b6b", shade: "#d15858", outline: INK };
const row = (px: string[], y: number) => px.slice(y * JELLY_W, (y + 1) * JELLY_W);

test("젤리 틀: 16×14, 편집 칸은 외곽선 안쪽만", () => {
  assert.equal(MASK.length, JELLY_W * JELLY_H);
  const px = jellyPixels(PRESETS[0].inner, colors, VARIANTS[0]);
  for (let i = 0; i < px.length; i++) {
    if (!MASK[i]) assert.equal(px[i], "", "마스크 밖은 투명");
    if (EDITABLE[i]) assert.ok(MASK[i]);
  }
  // 맨 윗줄·아랫줄의 칠한 칸은 모두 외곽선
  assert.ok(row(px, 0).filter(Boolean).every((c) => c === INK));
  assert.ok(row(px, JELLY_H - 1).filter(Boolean).every((c) => c === INK));
});

test("연결: 맞닿는 면은 목 폭으로 평평하고 외곽선이 없다 (위·아래 블록이 같은 폭으로 이어짐)", () => {
  const upper = jellyPixels(PRESETS[0].inner, colors, { connectUp: false, connectDown: true });
  const lower = jellyPixels(PRESETS[0].inner, colors, { connectUp: true, connectDown: false });
  const bottomRow = row(upper, JELLY_H - 1);
  const topRow = row(lower, 0);
  // 칠해진 칸 위치가 같다
  assert.deepEqual(bottomRow.map(Boolean), topRow.map(Boolean));
  assert.equal(topRow.filter(Boolean).length, NECK_W);
  // 양 끝만 외곽선, 가운데는 몸통
  const inside = topRow.filter(Boolean);
  assert.equal(inside[0], INK);
  assert.equal(inside[inside.length - 1], INK);
  assert.ok(inside.slice(1, -1).every((c) => c !== INK));
  assert.ok(bottomRow.filter(Boolean).slice(1, -1).every((c) => c !== INK));
});

test("안쪽 도트 정리: 마스크 밖·외곽선 칸 값은 버린다", () => {
  const raw = new Array(JELLY_W * JELLY_H).fill("#00ff00");
  const inner = clampInner(raw);
  inner.forEach((c, i) => assert.equal(c !== null, EDITABLE[i]));
  assert.ok(hiddenInner().some(Boolean));
});

test("자동 색: 팔레트 넘어서도 종류마다 다르다", () => {
  const set = new Set(Array.from({ length: 40 }, (_, i) => autoBodyColor(i)));
  assert.equal(set.size, 40);
  assert.equal(outlineColor("auto", "#101010"), "#ffffff");
  assert.equal(outlineColor("auto", "#ff6b6b"), INK);
  assert.equal(outlineColor("white", "#ff6b6b"), "#ffffff");
});

test("마크 기본 스킨 9종 얼굴 8×8, 넘치면 만든 얼굴이 서로·기본과 겹치지 않음", () => {
  assert.equal(DEFAULT_SKIN_FACES.length, 9);
  for (const f of DEFAULT_SKIN_FACES) {
    const dots = faceDots(f);
    assert.equal(dots.length, 64);
    assert.ok(dots.every((c) => /^#[0-9a-f]{6}$/.test(c)), f.id);
  }
  assert.equal(defaultFace(0).name, "스티브");
  const seen = new Set<string>();
  for (let t = 0; t < 300; t++) {
    const key = defaultFace(t).dots.join("");
    assert.ok(!seen.has(key), `종류 ${t} 얼굴이 겹침`);
    seen.add(key);
  }
  assert.deepEqual(generatedFace(20), generatedFace(20), "결정적");
});

test("블록: 18×18, 연결된 면은 외곽선 대신 얼굴 색", () => {
  const face = faceDots(DEFAULT_SKIN_FACES[0]);
  const alone = blockPixels(face, INK, VARIANTS[0]);
  const joined = blockPixels(face, INK, VARIANTS[3]);
  assert.equal(alone.length, BLOCK_W * BLOCK_H);
  assert.ok(alone.slice(0, BLOCK_W).every((c) => c === INK));
  assert.ok(joined.slice(1, BLOCK_W - 1).every((c) => c !== INK || face.includes(INK)));
  assert.equal(joined[0], INK, "옆 외곽선은 그대로");
});

test("스킨 PNG 픽셀 → 얼굴: 모자 층 합성, 예전 스킨의 꽉 찬 모자 층은 무시", () => {
  const make = (h: number, hatAlpha: number) => {
    const rgba = new Uint8ClampedArray(64 * h * 4);
    const put = (x: number, y: number, r: number, a: number) => rgba.set([r, 0, 0, a], (y * 64 + x) * 4);
    for (let y = 8; y < 16; y++) for (let x = 8; x < 16; x++) put(x, y, 0x11, 255);
    for (let y = 0; y < 16; y++) for (let x = 32; x < 64; x++) put(x, y, 0x22, hatAlpha);
    return { rgba, width: 64, height: h };
  };
  assert.equal(skinToFace(make(64, 255))![0], "#220000", "64×64는 모자 층 사용");
  assert.equal(skinToFace(make(64, 0))![0], "#110000", "투명한 모자 층은 얼굴");
  assert.equal(skinToFace(make(32, 255))![0], "#110000", "예전 스킨의 꽉 찬 모자 층은 무시");
  assert.equal(skinToFace({ rgba: new Uint8ClampedArray(4), width: 1, height: 1 }), null);
});
