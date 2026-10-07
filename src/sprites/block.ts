import { createRng, hashSeed } from "../game/rng";
import { DEFAULT_SKIN_FACES, faceDots } from "./defaultSkins";
import { INK, type Variant } from "./jelly";

/**
 * 마크 모드 블록 (기획서 8번): 정사각 머리 = 8×8 얼굴. 얼굴 도트 편집은 없고 스킨을 불러와서만 바꾼다.
 * 그릴 때는 얼굴 한 칸을 2×2로 키우고 둘레에 외곽선 1칸 → 18×18.
 * 같은 종류가 쌓이면 맞닿은 면의 외곽선 줄을 얼굴 끝 줄 색으로 채워 기둥처럼 잇는다.
 */

export const FACE = 8;
export const BLOCK_W = FACE * 2 + 2;
export const BLOCK_H = FACE * 2 + 2;

export type FaceSource = "default" | "generated" | "skin";

/** 종류 → 기본 얼굴. 기본 스킨 9종 다음부터는 코드로 만든 얼굴 */
export function defaultFace(typeId: number): { dots: string[]; name: string; source: FaceSource } {
  const skin = DEFAULT_SKIN_FACES[typeId];
  if (skin) return { dots: faceDots(skin), name: skin.name, source: "default" };
  return { dots: generatedFace(typeId), name: `블록 ${typeId + 1}`, source: "generated" };
}

// ── 임의 얼굴 ──

const SKINS = ["#f1c7a5", "#d9a07a", "#b97a52", "#8d5a3b", "#f6dcc6", "#9fd3a4"];
const HAIRS = ["#2b2118", "#6b3e1f", "#d8a13b", "#c4472f", "#4b5bd1", "#e07fb4", "#e8e8ee", "#3e9b5c", "#7a4fc0"];
const EYES = ["#3a63c8", "#2f8a4a", "#5a3a1e", "#8a39c4", "#c13a3a", "#1f1f2a"];
const STYLES = 4;
const MOUTHS = 3;
const COMBOS = HAIRS.length * SKINS.length * EYES.length * STYLES * MOUTHS;

/** 조합 번호 순서를 시드로 섞어 둔다 (종류 번호가 이어져도 비슷한 얼굴이 연달아 나오지 않게) */
const ORDER = (() => {
  const order = Array.from({ length: COMBOS }, (_, i) => i);
  const rng = createRng(hashSeed(8, 0xface));
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
})();

function darker(hex: string, k = 0.75) {
  const n = parseInt(hex.slice(1), 16);
  return "#" + [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.round(v * k).toString(16).padStart(2, "0")).join("");
}

/**
 * typeId로 정해지는 네모 도트 얼굴 (머리색·피부·눈·머리 모양·입 조합).
 * 조합 번호가 서로 다르면 얼굴도 다르다 — 기본 스킨 다음 종류부터 차례로 다른 조합을 쓰므로 겹치지 않는다.
 * (조합 수 ≈ 3,900개를 넘으면 처음부터 다시 쓰지만 머리띠 색을 바꿔 구분한다)
 */
export function generatedFace(typeId: number): string[] {
  const n = Math.max(0, typeId - DEFAULT_SKIN_FACES.length);
  let c = ORDER[n % COMBOS];
  const lap = Math.floor(n / COMBOS);
  const pick = (len: number) => {
    const v = c % len;
    c = Math.floor(c / len);
    return v;
  };
  const hair = HAIRS[pick(HAIRS.length)];
  const skin = SKINS[pick(SKINS.length)];
  const eye = EYES[pick(EYES.length)];
  const style = pick(STYLES);
  const mouth = pick(MOUTHS);
  const hairDark = darker(hair);
  const skinDark = darker(skin, 0.85);

  const f = new Array<string>(64).fill(skin);
  const set = (x: number, y: number, col: string) => (f[y * 8 + x] = col);
  // 머리카락: 0~1줄은 늘, 모양에 따라 옆머리·앞머리
  for (let x = 0; x < 8; x++) {
    set(x, 0, hair);
    set(x, 1, x % 3 === 1 ? hairDark : hair);
  }
  if (style === 0) for (const x of [0, 7]) set(x, 2, hair); // 짧은 머리
  if (style === 1) {
    // 옆머리 길게
    for (let y = 2; y < 6; y++) for (const x of [0, 7]) set(x, y, y > 3 ? hairDark : hair);
  }
  if (style === 2) {
    // 앞머리 지그재그
    for (const x of [0, 1, 3, 5, 6, 7]) set(x, 2, hair);
  }
  if (style === 3) {
    // 한쪽으로 넘긴 앞머리
    for (let x = 0; x < 5; x++) set(x, 2, hair);
    set(0, 3, hair);
  }
  // 눈 (흰자 + 눈동자)
  set(1, 4, "#ffffff");
  set(2, 4, eye);
  set(5, 4, eye);
  set(6, 4, "#ffffff");
  // 코 그림자
  set(3, 5, skinDark);
  set(4, 5, skinDark);
  // 입
  const lip = darker(skin, 0.6);
  if (mouth === 0) for (const x of [3, 4]) set(x, 6, lip);
  if (mouth === 1) for (const x of [2, 3, 4, 5]) set(x, 6, lip);
  if (mouth === 2) {
    set(2, 6, lip);
    set(5, 6, lip);
    set(3, 7, lip);
    set(4, 7, lip);
  }
  // 턱 그림자
  for (let x = 0; x < 8; x++) if (f[7 * 8 + x] === skin) set(x, 7, skinDark);
  if (lap > 0) {
    const band = HAIRS[(lap * 5) % HAIRS.length] === hair ? "#ffffff" : HAIRS[(lap * 5) % HAIRS.length];
    for (let x = 0; x < 8; x++) set(x, 1, band);
  }
  return f;
}

// ── 스킨 PNG → 얼굴 ──

type Src = { rgba: Uint8ClampedArray; width: number; height: number };

const ALPHA_CUT = 128;
const hex2 = (n: number) => n.toString(16).padStart(2, "0");

export function isSkinSize(w: number, h: number) {
  return w === 64 && (h === 64 || h === 32);
}

/**
 * 64×64(또는 예전 64×32) 스킨에서 얼굴(8,8)과 모자 층(40,8)을 합성해 8×8.
 * 모자 층은 불투명한 칸만 덮는다. 예전 스킨은 모자 층을 통째로 칠해 둔 경우가 많아, 전부 불투명하면 모자가 없는 것으로 본다(게임과 같음).
 * 얼굴 층의 투명 칸은 잉크색으로 채운다(머리 블록은 꽉 찬 네모).
 */
export function skinToFace(src: Src): string[] | null {
  if (!isSkinSize(src.width, src.height)) return null;
  const at = (x: number, y: number) => {
    const i = (y * src.width + x) * 4;
    return { a: src.rgba[i + 3], c: `#${hex2(src.rgba[i])}${hex2(src.rgba[i + 1])}${hex2(src.rgba[i + 2])}` };
  };
  let hatOpaque = true;
  if (src.height === 32) {
    for (let y = 0; y < 16 && hatOpaque; y++) for (let x = 32; x < 64; x++) if (at(x, y).a < ALPHA_CUT) hatOpaque = false;
  } else hatOpaque = false;
  const face: string[] = [];
  for (let y = 0; y < 8; y++)
    for (let x = 0; x < 8; x++) {
      const base = at(8 + x, 8 + y);
      const hat = at(40 + x, 8 + y);
      face.push(!hatOpaque && hat.a >= ALPHA_CUT ? hat.c : base.a >= ALPHA_CUT ? base.c : INK);
    }
  return face;
}

// ── 그리기용 픽셀 ──

/** "?" 블록: 회색 돌 + 흰 물음표 */
export const HIDDEN_FACE: string[] = (() => {
  const rows = [
    "aabaabaa",
    "ab.cc.ba",
    "a.c..c.a",
    "b....c.b",
    "a...c..a",
    "a..c...b",
    "b......a",
    "aa.c.aba",
  ];
  const col: Record<string, string> = { a: "#9a94ab", b: "#8a849b", ".": "#a9a3ba", c: "#ffffff" };
  return rows.flatMap((r) => [...r].map((k) => col[k]));
})();

/** 18×18 픽셀 ("" 없음 — 꽉 찬 네모) */
export function blockPixels(face: readonly string[], outline: string, v: Variant): string[] {
  const px = new Array<string>(BLOCK_W * BLOCK_H);
  for (let y = 0; y < BLOCK_H; y++)
    for (let x = 0; x < BLOCK_W; x++) {
      const fx = Math.min(FACE - 1, Math.max(0, Math.floor((x - 1) / 2)));
      const fy = Math.min(FACE - 1, Math.max(0, Math.floor((y - 1) / 2)));
      const side = x === 0 || x === BLOCK_W - 1;
      const top = y === 0;
      const bottom = y === BLOCK_H - 1;
      let c: string;
      if (side) c = outline;
      else if (top) c = v.connectUp ? face[fy * FACE + fx] : outline;
      else if (bottom) c = v.connectDown ? face[fy * FACE + fx] : outline;
      else c = face[fy * FACE + fx];
      px[y * BLOCK_W + x] = c;
    }
  return px;
}
