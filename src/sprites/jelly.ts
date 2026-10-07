/**
 * 뿌요식 도트 젤리 (기획서 6·7번). 순수 데이터 함수만 — 캔버스로 그리는 건 render.ts.
 *
 * 고정 틀: 약간 눌린 동그란 마스크(16×14). 마스크 가장자리 1칸이 외곽선(자동, 편집 불가),
 * 그 안쪽이 몸통(편집 가능 영역). 유저는 몸통 색과 안쪽 도트(눈·입·무늬)만 바꾼다.
 *
 * 연결: 같은 종류가 위아래로 맞닿으면 맞닿는 쪽을 "목" 폭까지 평평하게 넓히고 그 면의 외곽선을 지운다.
 * 위 블록의 아랫면과 아래 블록의 윗면이 같은 폭이라 빈틈 없이 한 덩어리로 이어진다.
 */

export const JELLY_W = 16;
export const JELLY_H = 14;

/** 몸통 마스크 ('#' = 젤리). 위는 둥글고 아래는 살짝 눌려 평평하게 */
const MASK_ROWS = [
  ".....######.....",
  "...##########...",
  "..############..",
  ".##############.",
  ".##############.",
  "################",
  "################",
  "################",
  "################",
  "################",
  "################",
  "################",
  ".##############.",
  "..############..",
] as const;

/** 연결되는 면의 폭 (가운데 정렬) */
export const NECK_W = 12;
const NECK_X0 = (JELLY_W - NECK_W) / 2;
const NECK_X1 = NECK_X0 + NECK_W - 1;

export const MASK: readonly boolean[] = MASK_ROWS.flatMap((row) => [...row].map((c) => c === "#"));

const inMask = (m: readonly boolean[], x: number, y: number) => x >= 0 && x < JELLY_W && y >= 0 && y < JELLY_H && m[y * JELLY_W + x];

/** 외곽선 칸: 마스크 안이면서 상하좌우 중 하나가 바깥 */
function outlineOf(mask: readonly boolean[], connectUp: boolean, connectDown: boolean): boolean[] {
  const out = new Array<boolean>(JELLY_W * JELLY_H).fill(false);
  const inside = (x: number, y: number) => {
    // 연결된 면 너머는 이웃 블록의 목이 이어지므로 안쪽으로 본다
    if (y < 0) return connectUp && x >= NECK_X0 && x <= NECK_X1;
    if (y >= JELLY_H) return connectDown && x >= NECK_X0 && x <= NECK_X1;
    return inMask(mask, x, y);
  };
  for (let y = 0; y < JELLY_H; y++)
    for (let x = 0; x < JELLY_W; x++) {
      if (!mask[y * JELLY_W + x]) continue;
      if (!inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1)) out[y * JELLY_W + x] = true;
    }
  return out;
}

/** 편집 가능한 칸 (기본 모양에서 외곽선을 뺀 안쪽) */
export const EDITABLE: readonly boolean[] = (() => {
  const line = outlineOf(MASK, false, false);
  return MASK.map((m, i) => m && !line[i]);
})();

export function isEditable(x: number, y: number) {
  return x >= 0 && x < JELLY_W && y >= 0 && y < JELLY_H && EDITABLE[y * JELLY_W + x];
}

/** 연결 변형 마스크: 연결된 쪽 둥근 줄들을 목 폭까지 넓힌다 */
function variantMask(connectUp: boolean, connectDown: boolean): boolean[] {
  const m = MASK.slice();
  const widen = (y: number) => {
    for (let x = NECK_X0; x <= NECK_X1; x++) m[y * JELLY_W + x] = true;
  };
  if (connectUp) for (let y = 0; y < JELLY_H / 2; y++) widen(y);
  if (connectDown) for (let y = Math.ceil(JELLY_H / 2); y < JELLY_H; y++) widen(y);
  return m;
}

export type Variant = { connectUp: boolean; connectDown: boolean };
export const VARIANTS: Variant[] = [
  { connectUp: false, connectDown: false },
  { connectUp: true, connectDown: false },
  { connectUp: false, connectDown: true },
  { connectUp: true, connectDown: true },
];
export const variantIndex = (v: Variant) => (v.connectUp ? 1 : 0) + (v.connectDown ? 2 : 0);

/** 안쪽 도트: 길이 W×H, 편집 가능한 칸만 의미가 있다. null = 몸통 색 그대로 */
export type Inner = (string | null)[];

export function emptyInner(): Inner {
  return new Array<string | null>(JELLY_W * JELLY_H).fill(null);
}

/** 마스크 밖·외곽선 칸의 값을 버린다 (불러오기·편집 결과 정리) */
export function clampInner(inner: readonly (string | null | undefined)[]): Inner {
  const out = emptyInner();
  for (let i = 0; i < out.length; i++) out[i] = EDITABLE[i] && typeof inner[i] === "string" ? (inner[i] as string) : null;
  return out;
}

export type JellyColors = { body: string; outline: string; shade: string };

/**
 * 한 변형의 픽셀 (길이 W×H, "" = 투명).
 * 아래쪽 안쪽 한 줄은 몸통보다 조금 어두운 그림자(연결된 아랫면엔 없음 — 이어지는 면이 끊겨 보이지 않게).
 */
export function jellyPixels(inner: Inner, colors: JellyColors, v: Variant): string[] {
  const mask = variantMask(v.connectUp, v.connectDown);
  const line = outlineOf(mask, v.connectUp, v.connectDown);
  const px = new Array<string>(JELLY_W * JELLY_H).fill("");
  for (let y = 0; y < JELLY_H; y++)
    for (let x = 0; x < JELLY_W; x++) {
      const i = y * JELLY_W + x;
      if (!mask[i]) continue;
      if (line[i]) {
        px[i] = colors.outline;
        continue;
      }
      const rim = !v.connectDown && y + 1 < JELLY_H && line[i + JELLY_W];
      px[i] = (EDITABLE[i] && inner[i]) || (rim ? colors.shade : colors.body);
    }
  return px;
}

/** "?" 블록 (가림 스테이지). 종류 정보 없이 회색 몸통 + 물음표 도트 */
const QUESTION = [
  ".###.",
  "#...#",
  "....#",
  "..##.",
  "..#..",
  ".....",
  "..#..",
] as const;

export const HIDDEN_BODY = "#bdb6cc";
export const HIDDEN_MARK = "#ffffff";

export function hiddenInner(): Inner {
  const inner = emptyInner();
  const ox = Math.floor((JELLY_W - 5) / 2);
  const oy = 4;
  QUESTION.forEach((row, y) => [...row].forEach((c, x) => c === "#" && (inner[(oy + y) * JELLY_W + ox + x] = HIDDEN_MARK)));
  return clampInner(inner);
}

// ── 프리셋 (눈·입·볼터치 세트) ──

const EYE = "#2a1f3d";
const WHITE = "#ffffff";
const BLUSH = "#ff7fa8";

/** 문자 그림 → 안쪽 도트. '#' 눈색, 'w' 흰색, 'p' 볼터치, 'r' 빨간 입 */
function art(rows: string[]): Inner {
  const colors: Record<string, string> = { "#": EYE, w: WHITE, p: BLUSH, r: "#d9435c" };
  const inner = emptyInner();
  rows.forEach((row, y) => [...row].forEach((c, x) => colors[c] && (inner[y * JELLY_W + x] = colors[c])));
  return clampInner(inner);
}

export type Preset = { id: string; name: string; inner: Inner };

export const PRESETS: Preset[] = [
  {
    id: "basic",
    name: "기본",
    inner: art([
      "................",
      "................",
      "................",
      "...ww...........",
      "..ww............",
      "................",
      "....w#....w#....",
      "....##....##....",
      "....##....##....",
      "................",
      ".......##.......",
      "................",
      "................",
      "................",
    ]),
  },
  {
    id: "smile",
    name: "방긋",
    inner: art([
      "................",
      "................",
      "................",
      "...ww...........",
      "..ww............",
      "................",
      "....##....##....",
      "...#..#..#..#...",
      "................",
      "..pp........pp..",
      "......#..#......",
      ".......##.......",
      "................",
      "................",
    ]),
  },
  {
    id: "round",
    name: "동글눈",
    inner: art([
      "................",
      "................",
      "................",
      "...ww...........",
      "..ww............",
      "...w#......w#...",
      "...##......##...",
      "...##......##...",
      "................",
      "..pp...rr...pp..",
      ".......rr.......",
      "................",
      "................",
      "................",
    ]),
  },
  {
    id: "sleepy",
    name: "졸린",
    inner: art([
      "................",
      "................",
      "................",
      "...ww...........",
      "..ww............",
      "................",
      "................",
      "...###....###...",
      "................",
      "................",
      "......####......",
      "................",
      "................",
      "................",
    ]),
  },
  {
    id: "wink",
    name: "윙크",
    inner: art([
      "................",
      "................",
      "................",
      "...ww...........",
      "..ww............",
      "................",
      "....w#..........",
      "....##....###...",
      "....##..........",
      "..pp........pp..",
      "......#.#.#.....",
      ".......#.#......",
      "................",
      "................",
    ]),
  },
  {
    id: "plain",
    name: "민무늬",
    inner: art([
      "................",
      "................",
      "................",
      "...ww...........",
      "..ww............",
    ]),
  },
];

export const DEFAULT_INNER: Inner = PRESETS[0].inner;

// ── 색 ──

/** 기본 팔레트: 종류마다 이 순서로 배정. 넘치면 황금각으로 색조를 돌려 만든다 */
export const BODY_PALETTE = [
  "#ff6b6b", // 빨강
  "#4d96ff", // 파랑
  "#ffd93d", // 노랑
  "#5fc86e", // 초록
  "#a66cff", // 보라
  "#ff9f43", // 주황
  "#ff8fc8", // 분홍
  "#3fd2e0", // 하늘
  "#a0714f", // 갈색
  "#e9e6f2", // 흰색
  "#3b4a8c", // 남색
  "#c5e35a", // 연두
  "#1f9e89", // 청록
  "#d63ca8", // 자주
] as const;

export function autoBodyColor(typeId: number): string {
  if (typeId < BODY_PALETTE.length) return BODY_PALETTE[typeId];
  const h = (typeId * 137.508) % 360;
  return hslToHex(h, 0.65, typeId % 2 ? 0.55 : 0.68);
}

export function hslToHex(h: number, s: number, l: number): string {
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return "#" + [f(0), f(8), f(4)].map((v) => Math.round(v * 255).toString(16).padStart(2, "0")).join("");
}

function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1, 7), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function luminance(hex: string) {
  const [r, g, b] = rgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** 몸통보다 조금 어두운 색 (아래 그림자) */
export function shadeOf(hex: string): string {
  return "#" + rgb(hex).map((v) => Math.round(v * 0.82).toString(16).padStart(2, "0")).join("");
}

export type OutlineSetting = "black" | "white" | "auto";
export const INK = "#2a1f3d";

/**
 * 외곽선 색. 자동은 판 배경(밝은 병 안쪽)과 몸통 대비로 정한다:
 * 몸통이 아주 어두우면 검은 선이 몸통에 묻히므로 흰 선, 그 밖에는 진한 잉크색.
 */
export function outlineColor(setting: OutlineSetting, body: string): string {
  if (setting === "black") return INK;
  if (setting === "white") return "#ffffff";
  return luminance(body) < 0.06 ? "#ffffff" : INK;
}
