import type { Bottle, GameState } from "@/game/rules";
import { topRun } from "@/game/rules";
import { cellPosition, LIFT, RIM_H, WALL, type BoardLayout, type BottleRect } from "./layout";
import { drawNumberBadge, HIDDEN, type SpriteBank } from "./spriteBank";

/**
 * 판 그리기 (Canvas 2D, 기기 픽셀 좌표). 모든 도형은 단위 × 정수 배율 → 도트가 또렷하다.
 * 모션(기획서 7번, 150~250ms):
 *  - 선택: 맨 위 같은 종류 덩어리가 살짝 떠오름
 *  - 이동: 떨어져 나온 블록이 연결이 풀린 채 날아가서
 *  - 착지: 도착 병에서 다시 붙으며 아래로 눌렸다 돌아옴
 */

export type Flight = {
  /** 옮겨진 블록 종류 (아래→위). 공개된 상태 그대로 */
  cells: { typeId: number; revealed: boolean }[];
  from: number;
  to: number;
  /** 출발 병에서 이 블록들이 있던 첫 칸 번호 (아래부터) */
  fromIndex: number;
  /** 도착 병에서 들어갈 첫 칸 번호 */
  toIndex: number;
  /** 0~1 */
  t: number;
};

export type Landing = { bottle: number; fromIndex: number; count: number; t: number };

export type SceneColors = { ink: string; glass: string; glassShine: string; rim: string; selected: string; star: string; starEdge: string };

export type Scene = {
  state: GameState;
  layout: BoardLayout;
  bank: SpriteBank;
  selected: number | null;
  /** 0~1 선택 떠오름 진행 */
  lift: number;
  flight: Flight | null;
  landing: Landing | null;
  showNumbers: boolean;
  colors: SceneColors;
};

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const easeOut = (t: number) => 1 - (1 - t) * (1 - t);

/** 아래쪽 모서리를 2단 계단으로 둥글린 사각형 (단위 좌표 → 기기 px) */
function fillRounded(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, s: number) {
  ctx.fillRect(x * s, y * s, w * s, (h - 2) * s);
  ctx.fillRect((x + 1) * s, (y + h - 2) * s, (w - 2) * s, s);
  ctx.fillRect((x + 2) * s, (y + h - 1) * s, (w - 4) * s, s);
}

function isComplete(b: Bottle, capacity: number) {
  return b.length === capacity && b.every((c) => c.revealed && c.typeId === b[0].typeId);
}

function drawBottle(ctx: CanvasRenderingContext2D, scene: Scene, r: BottleRect, selected: boolean) {
  const { layout, colors } = scene;
  const s = layout.scale;
  const bw = layout.bottleW;
  const bh = layout.bottleH;
  ctx.save();
  ctx.translate(r.x, r.y);
  const line = selected ? colors.selected : colors.ink;
  // 몸통: 외곽선 → 유리
  ctx.fillStyle = line;
  fillRounded(ctx, 0, RIM_H - 1, bw, bh - RIM_H + 1, s);
  ctx.fillStyle = colors.glass;
  fillRounded(ctx, WALL, RIM_H - 1, bw - WALL * 2, bh - RIM_H + 1 - WALL, s);
  // 유리 반짝임 (왼쪽 세로줄)
  ctx.fillStyle = colors.glassShine;
  ctx.fillRect((WALL) * s, (RIM_H + 1) * s, s, (bh - RIM_H - 5) * s);
  // 입구 테두리
  ctx.fillStyle = line;
  ctx.fillRect(-s, 0, (bw + 2) * s, RIM_H * s);
  ctx.fillStyle = colors.rim;
  ctx.fillRect(0, s, bw * s, (RIM_H - 2) * s);
  ctx.restore();
}

/** 5×5 도트 별 (완성한 병 위) */
const STAR = ["..#..", ".###.", "#####", ".###.", ".#.#."];

function drawStar(ctx: CanvasRenderingContext2D, scene: Scene, r: BottleRect) {
  const s = scene.layout.scale;
  const x0 = r.x + Math.floor((r.w - 7 * s) / 2 / s) * s;
  const y0 = r.y - 8 * s;
  ctx.fillStyle = scene.colors.starEdge;
  STAR.forEach((row, y) =>
    [...row].forEach((c, x) => {
      if (c !== "#") return;
      ctx.fillRect(x0 + x * s, y0 + y * s, 3 * s, 3 * s);
    }),
  );
  ctx.fillStyle = scene.colors.star;
  STAR.forEach((row, y) => [...row].forEach((c, x) => c === "#" && ctx.fillRect(x0 + (x + 1) * s, y0 + (y + 1) * s, s, s)));
}

function drawCell(
  ctx: CanvasRenderingContext2D,
  scene: Scene,
  cell: { typeId: number; revealed: boolean },
  up: boolean,
  down: boolean,
  x: number,
  y: number,
  sx = 1,
  sy = 1,
) {
  const { bank, layout } = scene;
  const s = layout.scale;
  const typeId = cell.revealed ? cell.typeId : HIDDEN;
  const img = bank.get(typeId, { connectUp: up, connectDown: down });
  const w = bank.cellW * s;
  const h = bank.cellH * s;
  if (sx === 1 && sy === 1) ctx.drawImage(img, x, y, w, h);
  else {
    // 아래 가운데를 기준으로 눌림/늘어남. 크기는 정수 px로 반올림
    const dw = Math.round(w * sx);
    const dh = Math.round(h * sy);
    ctx.drawImage(img, Math.round(x + (w - dw) / 2), Math.round(y + h - dh), dw, dh);
  }
  if (scene.showNumbers && cell.revealed && !up) {
    // 배율이 작을 때도 읽히게: 2배 이하면 블록과 같은 단위, 그 위로는 절반
    drawNumberBadge(ctx, cell.typeId + 1, x + w, y + h - (down ? 0 : 1) * s, s <= 2 ? s : Math.ceil(s / 2));
  }
}

/** 같은 종류가 위아래로 맞닿는지 ("?" 블록은 연결하지 않는다) */
function joins(a: { typeId: number; revealed: boolean } | undefined, b: { typeId: number; revealed: boolean } | undefined) {
  return !!a && !!b && a.revealed && b.revealed && a.typeId === b.typeId;
}

export function drawScene(ctx: CanvasRenderingContext2D, scene: Scene) {
  const { state, layout, flight, landing } = scene;
  const s = layout.scale;
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  layout.bottles.forEach((r, bi) => {
    const bottle = state.bottles[bi];
    drawBottle(ctx, scene, r, scene.selected === bi);
    if (bottle && isComplete(bottle, state.capacity) && !(flight && flight.to === bi)) drawStar(ctx, scene, r);
    if (!bottle) return;

    // 날아오는 중인 블록은 아직 도착 병에 그리지 않는다
    const hiddenTop = flight && flight.to === bi ? flight.cells.length : 0;
    const visible = bottle.length - hiddenTop;
    const run = scene.selected === bi ? topRun(bottle) : 0;
    const liftPx = Math.round(easeOut(scene.lift) * (LIFT - 1)) * s;

    // 착지 눌림: 도착한 덩어리와 그 아래로 이어진 같은 종류까지 함께
    let squashFrom = Infinity;
    let squash = 0;
    if (landing && landing.bottle === bi) {
      squashFrom = landing.fromIndex;
      while (squashFrom > 0 && joins(bottle[squashFrom - 1], bottle[squashFrom])) squashFrom--;
      squash = Math.sin(Math.PI * landing.t);
    }

    for (let i = 0; i < visible; i++) {
      const cell = bottle[i];
      const lifted = i >= bottle.length - run;
      // 떠오른 덩어리는 아래와 떨어진다 (연결이 풀림)
      const down = joins(cell, bottle[i - 1]) && !(lifted && i === bottle.length - run && scene.lift > 0);
      const up = i + 1 < visible && joins(cell, bottle[i + 1]);
      const pos = cellPosition(layout, r, i, state.capacity);
      if (i >= squashFrom && squash > 0) {
        // 덩어리 전체가 바닥 쪽을 기준으로 눌렸다 돌아온다
        const sy = 1 - 0.12 * squash;
        const h = layout.cellH * s;
        const groupBottom = cellPosition(layout, r, squashFrom, state.capacity).y + h;
        const y = groupBottom - (i - squashFrom) * h * sy - h;
        drawCell(ctx, scene, cell, up, down, pos.x, Math.round(y), 1 + 0.06 * squash, sy);
      } else drawCell(ctx, scene, cell, up, down, pos.x, pos.y - (lifted ? liftPx : 0));
    }
  });

  if (flight) drawFlight(ctx, scene, flight);
}

function drawFlight(ctx: CanvasRenderingContext2D, scene: Scene, f: Flight) {
  const { layout, state } = scene;
  const s = layout.scale;
  const from = layout.bottles[f.from];
  const to = layout.bottles[f.to];
  if (!from || !to) return;
  const liftPx = (LIFT - 1) * s;
  // 1단계(0~0.6): 출발 병 위 → 도착 병 위로 호를 그리며, 2단계(0.6~1): 도착 병 안으로 내려앉음
  const t = f.t;
  f.cells.forEach((cell, k) => {
    const a = cellPosition(layout, from, f.fromIndex + k, state.capacity);
    const b = cellPosition(layout, to, f.toIndex + k, state.capacity);
    const ay = a.y - liftPx;
    // 도착 병 위 대기 자리: 입구보다 위
    const hoverY = Math.min(ay, to.y - (k + 1) * layout.cellH * s - s);
    let x: number;
    let y: number;
    if (t < 0.6) {
      const u = easeOut(t / 0.6);
      x = lerp(a.x, b.x, u);
      y = lerp(ay, hoverY, u) - Math.sin(Math.PI * u) * 6 * s;
    } else {
      const u = (t - 0.6) / 0.4;
      x = b.x;
      y = lerp(hoverY, b.y, u * u);
    }
    const up = k + 1 < f.cells.length;
    const down = k > 0;
    // 날아가는 동안은 옮기는 덩어리끼리만 붙어 있고, 병 속 블록과는 떨어져 있다
    drawCell(ctx, scene, cell, up && joins(cell, f.cells[k + 1]), down && joins(cell, f.cells[k - 1]), Math.round(x), Math.round(y));
  });
}
