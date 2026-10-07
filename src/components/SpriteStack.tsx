"use client";

import { useEffect, useMemo, useRef } from "react";
import { useSave } from "./SaveProvider";
import { SpriteBank, type Look } from "@/render/spriteBank";

/** 지금 저장 데이터로 만든 모습. 저장 데이터가 바뀌면 새 캐시 */
export function useBank(override?: Partial<Look>): SpriteBank {
  const { save } = useSave();
  const { mode, outline } = save.settings;
  const base = override?.base ?? save.jelly.base;
  const jellyTypes = override?.jellyTypes ?? save.jelly.types;
  const blockTypes = override?.blockTypes ?? save.block.types;
  const m = override?.mode ?? mode;
  const o = override?.outline ?? outline;
  return useMemo(() => new SpriteBank({ mode: m, outline: o, base, jellyTypes, blockTypes }), [m, o, base, jellyTypes, blockTypes]);
}

type Props = {
  bank: SpriteBank;
  /** 아래→위 종류. 이웃이 같으면 이어서 그린다 */
  types: number[];
  /** 도트 한 칸의 CSS px */
  unit: number;
  label: string;
  /** 가로로 나란히 (같은 종류도 잇지 않음) */
  row?: boolean;
  className?: string;
};

/** 블록 몇 개를 쌓아(또는 나란히) 그리는 작은 그림. 연결 미리보기·메뉴 장식에 쓴다 */
export function SpriteStack({ bank, types, unit, label, row = false, className }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const cw = bank.cellW;
  const ch = bank.cellH;
  const gap = row ? 2 : 0;
  const w = row ? types.length * cw + (types.length - 1) * gap : cw;
  const h = row ? ch : types.length * ch;

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const dpr = Math.min(3, Math.max(1, Math.round(window.devicePixelRatio || 1)));
    const s = unit * dpr;
    canvas.width = w * s;
    canvas.height = h * s;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    types.forEach((t, i) => {
      if (row) {
        ctx.drawImage(bank.get(t, { connectUp: false, connectDown: false }), i * (cw + gap) * s, 0, cw * s, ch * s);
        return;
      }
      // 아래→위: i=0이 맨 아래
      const y = (types.length - 1 - i) * ch * s;
      const up = types[i + 1] === t;
      const down = types[i - 1] === t;
      ctx.drawImage(bank.get(t, { connectUp: up, connectDown: down }), 0, y, cw * s, ch * s);
    });
  }, [bank, types, unit, w, h, cw, ch, row, gap]);

  return <canvas ref={ref} className={className} role="img" aria-label={label} style={{ width: w * unit, height: h * unit, imageRendering: "pixelated" }} />;
}
