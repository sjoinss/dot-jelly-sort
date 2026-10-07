"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import { EDITABLE, JELLY_H, JELLY_W } from "@/sprites/jelly";
import styles from "./DotCanvas.module.css";

export type Tool = "pen" | "eraser" | "eyedropper";
export type PointerPhase = "start" | "move" | "end" | "cancel";

type Props = {
  /** 그릴 픽셀 (W×H, "" = 투명) */
  pixels: string[];
  tool: Tool;
  label: string;
  onCell: (phase: PointerPhase, x: number, y: number) => void;
};

const CHECKER_A = "#fffdf8";
const CHECKER_B = "#f1e8f4";

/**
 * 확대 편집 뷰 (점프점프 DotCanvas와 같은 조작: 누른 채 끌면 연속, 두 번째 손가락이면 그 붓질 취소).
 * 편집할 수 있는 칸은 몸통 안쪽뿐 — 외곽선·바깥은 그려도 무시되고, 격자도 안쪽에만 그린다.
 */
export function JellyCanvas({ pixels, tool, label, onCell }: Props) {
  const boxRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [cell, setCell] = useState(16);
  const [hover, setHover] = useState<[number, number] | null>(null);
  const activePointer = useRef<number | null>(null);
  const lastCell = useRef<[number, number] | null>(null);

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const fit = () => {
      const { width, height } = box.getBoundingClientRect();
      setCell(Math.max(6, Math.min(28, Math.floor(Math.min((width - 8) / JELLY_W, (height - 8) / JELLY_H)))));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(box);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const w = JELLY_W * cell;
    const h = JELLY_H * cell;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    for (let y = 0; y < JELLY_H; y++)
      for (let x = 0; x < JELLY_W; x++) {
        const c = pixels[y * JELLY_W + x];
        ctx.fillStyle = c || ((x + y) % 2 === 0 ? CHECKER_A : CHECKER_B);
        ctx.fillRect(x * cell, y * cell, cell, cell);
      }

    // 안쪽 칸에만 격자 (편집할 수 있는 곳이 어디인지 보이게)
    ctx.fillStyle = "rgba(61,44,94,0.16)";
    for (let y = 0; y < JELLY_H; y++)
      for (let x = 0; x < JELLY_W; x++) {
        if (!EDITABLE[y * JELLY_W + x]) continue;
        ctx.fillRect(x * cell, y * cell, cell, 1);
        ctx.fillRect(x * cell, y * cell, 1, cell);
      }

    if (hover) {
      const [cx, cy] = hover;
      const ok = EDITABLE[cy * JELLY_W + cx];
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#ffffff";
      ctx.strokeRect(cx * cell + 2, cy * cell + 2, cell - 4, cell - 4);
      ctx.strokeStyle = ok ? "#3d2c5e" : "#c02a37";
      ctx.strokeRect(cx * cell + 1, cy * cell + 1, cell - 2, cell - 2);
    }
  }, [pixels, cell, hover]);

  const cellAt = (e: PointerEvent<HTMLCanvasElement>): [number, number] => {
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    const x = Math.floor(((e.clientX - rect.left - el.clientLeft) / el.clientWidth) * JELLY_W);
    const y = Math.floor(((e.clientY - rect.top - el.clientTop) / el.clientHeight) * JELLY_H);
    return [Math.max(0, Math.min(JELLY_W - 1, x)), Math.max(0, Math.min(JELLY_H - 1, y))];
  };

  const onPointerDown = (e: PointerEvent<HTMLCanvasElement>) => {
    if (activePointer.current !== null) {
      const [x, y] = lastCell.current ?? cellAt(e);
      onCell("cancel", x, y);
      activePointer.current = null;
      lastCell.current = null;
      return;
    }
    if (e.pointerType === "mouse" && e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    activePointer.current = e.pointerId;
    const c = cellAt(e);
    lastCell.current = c;
    onCell("start", c[0], c[1]);
  };

  const onPointerMove = (e: PointerEvent<HTMLCanvasElement>) => {
    const c = cellAt(e);
    if (e.pointerType === "mouse") setHover((h) => (h && h[0] === c[0] && h[1] === c[1] ? h : c));
    if (e.pointerId !== activePointer.current) return;
    const last = lastCell.current;
    if (last && last[0] === c[0] && last[1] === c[1]) return;
    lastCell.current = c;
    onCell("move", c[0], c[1]);
  };

  const onPointerEnd = (e: PointerEvent<HTMLCanvasElement>) => {
    if (e.pointerId !== activePointer.current) return;
    const c = lastCell.current ?? cellAt(e);
    activePointer.current = null;
    lastCell.current = null;
    onCell(e.type === "pointercancel" ? "cancel" : "end", c[0], c[1]);
  };

  return (
    <div ref={boxRef} className={styles.box}>
      <canvas
        ref={canvasRef}
        className={`${styles.canvas} ${styles[`tool_${tool}`]}`}
        style={{ width: JELLY_W * cell, height: JELLY_H * cell }}
        role="img"
        aria-label={label}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onPointerLeave={() => setHover(null)}
      />
    </div>
  );
}
