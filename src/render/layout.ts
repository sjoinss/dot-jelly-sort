/**
 * 병 배치 (순수 계산). 단위(unit) = 도트 한 칸. 기기 픽셀 기준 정수 배율(scale)만 써서 도트가 흐려지지 않게 한다.
 *
 * 병 하나 (단위):
 *   ┌ 입구 테두리 (병보다 양옆 1칸 넓게, 3칸 높이)
 *   │ 여유 2칸
 *   │ 칸 × 용량
 *   └ 바닥 여유 1칸 + 바닥 벽 1칸
 *   벽 1칸 + 안쪽 여백 1칸이 양옆에
 * 병 위로 LIFT 칸은 선택한 블록이 떠오르는 자리.
 */

export const WALL = 1;
export const PAD = 1;
export const RIM_H = 3;
export const HEAD = 2;
export const LIFT = 7;
export const GAP_X = 3;
export const GAP_Y = 4;

/** 병 하나. 용량이 작은 병(여분 병)은 키가 작고, 같은 줄의 다른 병과 바닥을 맞춘다 */
export type BottleRect = { x: number; y: number; w: number; h: number; index: number; cap: number };

export type BoardLayout = {
  /** 기기 픽셀 / 단위 */
  scale: number;
  rows: number;
  bottleW: number;
  /** 가장 큰 병의 높이 (단위) */
  bottleH: number;
  /** 병 몸통 사각형 (기기 px, 입구 테두리 포함, LIFT 미포함) */
  bottles: BottleRect[];
  /** 칸 하나 크기 (단위) */
  cellW: number;
  cellH: number;
};

export function bottleSize(cellW: number, cellH: number, capacity: number) {
  return { w: cellW + (WALL + PAD) * 2, h: RIM_H + HEAD + cellH * capacity + PAD + WALL };
}

/** 줄 나누기: 위 줄부터 같은 수, 남는 건 앞 줄들에 하나씩 */
export function splitRows(n: number, rows: number): number[] {
  const base = Math.floor(n / rows);
  const extra = n % rows;
  return Array.from({ length: rows }, (_, i) => base + (i < extra ? 1 : 0));
}

/**
 * 판 크기(기기 px) 안에 병들(용량 목록)을 가장 크게 배치.
 * 줄 수를 1~4로 바꿔 보고 가장 큰 배율을 고른다(같으면 줄이 적은 쪽).
 */
export function layoutBoard(width: number, height: number, capacities: number[], cellW: number, cellH: number): BoardLayout {
  const n = capacities.length;
  const { w: bw, h: bh } = bottleSize(cellW, cellH, Math.max(1, ...capacities));
  let best = { scale: 1, rows: 1 };
  for (let rows = 1; rows <= Math.min(4, n); rows++) {
    const perRow = Math.ceil(n / rows);
    // 입구 테두리가 양옆으로 1칸씩 나온다
    const unitsW = perRow * bw + (perRow - 1) * GAP_X + 2;
    const unitsH = rows * (bh + LIFT) + (rows - 1) * GAP_Y;
    const scale = Math.max(1, Math.floor(Math.min(width / unitsW, height / unitsH)));
    if (scale > best.scale) best = { scale, rows };
  }
  const { scale, rows } = best;
  const counts = splitRows(n, rows);
  const rowH = (bh + LIFT) * scale;
  const totalH = rows * rowH + (rows - 1) * GAP_Y * scale;
  const top = Math.max(0, Math.floor((height - totalH) / 2));
  const bottles: BottleRect[] = [];
  let index = 0;
  counts.forEach((count, r) => {
    const rowW = (count * bw + (count - 1) * GAP_X) * scale;
    const left = Math.floor((width - rowW) / 2);
    for (let i = 0; i < count; i++) {
      const cap = capacities[index];
      const h = bottleSize(cellW, cellH, cap).h;
      bottles.push({
        x: left + i * (bw + GAP_X) * scale,
        y: top + r * (rowH + GAP_Y * scale) + (LIFT + bh - h) * scale,
        w: bw * scale,
        h: h * scale,
        index: index++,
        cap,
      });
    }
  });
  return { scale, rows, bottleW: bw, bottleH: bh, bottles, cellW, cellH };
}

/** 병 안 i번째 칸(아래부터)의 왼쪽 위 (기기 px) */
export function cellPosition(layout: BoardLayout, bottle: BottleRect, i: number) {
  const s = layout.scale;
  const x = bottle.x + (WALL + PAD) * s;
  const bottomOfStack = bottle.y + (RIM_H + HEAD + layout.cellH * bottle.cap) * s;
  return { x, y: bottomOfStack - (i + 1) * layout.cellH * s };
}
