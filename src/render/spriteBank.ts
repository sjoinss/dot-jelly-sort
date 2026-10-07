import type { Mode, SpriteDef } from "@/lib/save";
import { BLOCK_H, BLOCK_W, blockPixels, defaultFace, HIDDEN_FACE } from "@/sprites/block";
import {
  autoBodyColor,
  HIDDEN_BODY,
  hiddenInner,
  INK,
  JELLY_H,
  JELLY_W,
  jellyPixels,
  outlineColor,
  shadeOf,
  variantIndex,
  type Inner,
  type OutlineSetting,
  type Variant,
} from "@/sprites/jelly";

/** 화면에 그릴 모습을 정하는 값 전체. 이 값이 바뀌면 새 SpriteBank를 만든다(= 캐시 무효화) */
export type Look = {
  mode: Mode;
  outline: OutlineSetting;
  base: Inner;
  jellyTypes: Record<string, SpriteDef>;
  blockTypes: Record<string, SpriteDef>;
};

export const HIDDEN = -1;

/**
 * 종류 × 연결 변형(4가지)을 1배 크기 캔버스로 미리 그려 두는 곳 (기획서 7번 "변형을 미리 렌더해 캐시").
 * 그릴 때는 정수 배율로 drawImage (imageSmoothingEnabled = false).
 */
export class SpriteBank {
  readonly cellW: number;
  readonly cellH: number;
  private cache = new Map<string, HTMLCanvasElement>();
  private hiddenInnerCache: Inner | null = null;

  constructor(readonly look: Look) {
    this.cellW = look.mode === "jelly" ? JELLY_W : BLOCK_W;
    this.cellH = look.mode === "jelly" ? JELLY_H : BLOCK_H;
  }

  /** typeId의 몸통 색 (젤리). 따로 편집한 종류면 그 색 */
  bodyColor(typeId: number) {
    return this.look.jellyTypes[typeId]?.bodyColor ?? autoBodyColor(typeId);
  }

  pixels(typeId: number, v: Variant): string[] {
    const { look } = this;
    if (look.mode === "jelly") {
      if (typeId === HIDDEN) {
        this.hiddenInnerCache ??= hiddenInner();
        const body = HIDDEN_BODY;
        return jellyPixels(this.hiddenInnerCache, { body, shade: shadeOf(body), outline: outlineColor(look.outline, body) }, v);
      }
      const custom = look.jellyTypes[typeId];
      const body = custom?.bodyColor ?? autoBodyColor(typeId);
      return jellyPixels(custom?.inner ?? look.base, { body, shade: shadeOf(body), outline: outlineColor(look.outline, body) }, v);
    }
    const line = look.outline === "white" ? "#ffffff" : INK;
    if (typeId === HIDDEN) return blockPixels(HIDDEN_FACE, line, v);
    const face = (look.blockTypes[typeId]?.inner as string[] | undefined) ?? defaultFace(typeId).dots;
    return blockPixels(face, line, v);
  }

  get(typeId: number, v: Variant): HTMLCanvasElement {
    const key = `${typeId}:${variantIndex(v)}`;
    let c = this.cache.get(key);
    if (!c) {
      c = pixelsToCanvas(this.pixels(typeId, v), this.cellW, this.cellH);
      this.cache.set(key, c);
    }
    return c;
  }
}

export function pixelsToCanvas(px: readonly string[], w: number, h: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(w, h);
  for (let i = 0; i < px.length; i++) {
    const c = px[i];
    if (!c) continue;
    const n = parseInt(c.slice(1, 7), 16);
    img.data[i * 4] = (n >> 16) & 255;
    img.data[i * 4 + 1] = (n >> 8) & 255;
    img.data[i * 4 + 2] = n & 255;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

/** 3×5 도트 숫자 (종류 번호 표시용) */
const DIGITS: Record<string, string[]> = {
  "0": ["###", "#.#", "#.#", "#.#", "###"],
  "1": [".#.", "##.", ".#.", ".#.", "###"],
  "2": ["###", "..#", "###", "#..", "###"],
  "3": ["###", "..#", ".##", "..#", "###"],
  "4": ["#.#", "#.#", "###", "..#", "..#"],
  "5": ["###", "#..", "###", "..#", "###"],
  "6": ["###", "#..", "###", "#.#", "###"],
  "7": ["###", "..#", ".#.", ".#.", ".#."],
  "8": ["###", "#.#", "###", "#.#", "###"],
  "9": ["###", "#.#", "###", "..#", "###"],
};

/** 숫자 배지: 잉크 바탕 + 흰 숫자, 한 칸 = unit px. 오른쪽 아래 기준 (x, y는 배지 오른쪽 아래 모서리) */
export function drawNumberBadge(ctx: CanvasRenderingContext2D, n: number, right: number, bottom: number, unit: number) {
  const text = String(n);
  const w = text.length * 4 + 1;
  const h = 7;
  const x0 = right - w * unit;
  const y0 = bottom - h * unit;
  ctx.fillStyle = INK;
  ctx.fillRect(x0, y0, w * unit, h * unit);
  ctx.fillStyle = "#ffffff";
  [...text].forEach((d, i) => {
    DIGITS[d]?.forEach((row, y) =>
      [...row].forEach((c, x) => c === "#" && ctx.fillRect(x0 + (1 + i * 4 + x) * unit, y0 + (1 + y) * unit, unit, unit)),
    );
  });
}
