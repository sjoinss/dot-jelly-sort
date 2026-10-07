import { STAGE } from "../config/stage";

/**
 * 게임 규칙 (기획서 4번). 순수 함수만 — 화면과 무관하게 테스트한다.
 * 병은 아래→위 스택. 같은 종류 판정은 오직 typeId.
 */

export type Cell = { typeId: number; revealed: boolean };
export type Bottle = Cell[];

export type Snapshot = { bottles: Bottle[]; moves: number };

export type GameState = {
  bottles: Bottle[];
  /** 스테이지 병 용량 (클리어 판정 기준) */
  capacity: number;
  /** 병마다 용량. 여분 병은 STAGE.SPARE_CAPACITY */
  capacities: number[];
  moves: number;
  undoLeft: number;
  /** 되돌리기용 직전 상태 (최대 UNDO_LIMIT개) */
  history: Snapshot[];
  hiddenMode: boolean;
};

export type Move = { from: number; to: number; count: number };

export function createGame(bottles: number[][], capacity: number, hiddenMode: boolean): GameState {
  const state: GameState = {
    bottles: bottles.map((b) => b.map((typeId) => ({ typeId, revealed: !hiddenMode }))),
    capacity,
    capacities: bottles.map(() => capacity),
    moves: 0,
    undoLeft: STAGE.UNDO_LIMIT,
    history: [],
    hiddenMode,
  };
  return revealTops(state);
}

/** 맨 위 블록은 늘 보인다. 한 번 공개된 블록은 계속 공개 */
function revealTops(state: GameState): GameState {
  if (!state.hiddenMode) return state;
  let changed = false;
  const bottles = state.bottles.map((b) => {
    // 맨 위와 같은 종류가 바로 아래로 이어져 있으면 그 덩어리 전체가 보인다 (원작과 같음)
    const run = topRun(b);
    if (b.slice(b.length - run).every((c) => c.revealed)) return b;
    changed = true;
    return b.map((c, i) => (i >= b.length - run && !c.revealed ? { ...c, revealed: true } : c));
  });
  return changed ? { ...state, bottles } : state;
}

/** 맨 위부터 이어진 같은 종류 블록 수 */
export function topRun(bottle: Bottle): number {
  if (bottle.length === 0) return 0;
  const t = bottle[bottle.length - 1].typeId;
  let n = 0;
  for (let i = bottle.length - 1; i >= 0 && bottle[i].typeId === t; i--) n++;
  return n;
}

export function capacityOf(state: GameState, bottle: number): number {
  return state.capacities[bottle] ?? state.capacity;
}

/**
 * 여분 병 받기: 빈 병(용량 STAGE.SPARE_CAPACITY) 하나를 끝에 더한다. 횟수 제한 없음, 이동으로 세지 않는다.
 * 다시하기하면 사라진다(처음 상태로). 클리어하려면 여분 병은 비어 있어야 한다 — 한 종류가 다 모일 수 없으므로.
 */
export function addSpareBottle(state: GameState): GameState {
  return {
    ...state,
    bottles: [...state.bottles, []],
    capacities: [...state.bottles.map((_, i) => capacityOf(state, i)), STAGE.SPARE_CAPACITY],
  };
}

/** 옮길 수 있으면 실제로 옮겨지는 개수, 아니면 0. 빈칸이 모자라면 들어가는 만큼만 */
export function moveCount(state: GameState, from: number, to: number): number {
  if (from === to) return 0;
  const src = state.bottles[from];
  const dst = state.bottles[to];
  if (!src || !dst || src.length === 0) return 0;
  const space = capacityOf(state, to) - dst.length;
  if (space <= 0) return 0;
  const t = src[src.length - 1].typeId;
  if (dst.length > 0 && dst[dst.length - 1].typeId !== t) return 0;
  return Math.min(topRun(src), space);
}

export function applyMove(state: GameState, from: number, to: number): { state: GameState; move: Move } | null {
  const count = moveCount(state, from, to);
  if (count === 0) return null;
  const bottles = state.bottles.slice();
  const src = bottles[from];
  const moved = src.slice(src.length - count);
  bottles[from] = src.slice(0, src.length - count);
  bottles[to] = [...bottles[to], ...moved];
  const history = [...state.history, { bottles: state.bottles, moves: state.moves }].slice(-STAGE.UNDO_LIMIT);
  const next = revealTops({ ...state, bottles, moves: state.moves + 1, history });
  return { state: next, move: { from, to, count } };
}

/** 직전 이동 1회 취소. 공개된 블록은 다시 가리지 않는다 (공개 상태 유지) */
export function undo(state: GameState): GameState | null {
  if (state.undoLeft <= 0 || state.history.length === 0) return null;
  const prev = state.history[state.history.length - 1];
  // 그 뒤에 받은 여분 병은 남겨 둔다 (그때는 비어 있었다)
  const padded = [...prev.bottles, ...state.bottles.slice(prev.bottles.length).map(() => [])];
  const bottles = state.hiddenMode ? keepRevealed(padded, state.bottles) : padded;
  return {
    ...state,
    bottles,
    moves: prev.moves,
    undoLeft: state.undoLeft - 1,
    history: state.history.slice(0, -1),
  };
}

/**
 * 되돌린 뒤에도 이미 본 블록은 계속 보이게: 지금 상태에서 공개된 블록이 이전 상태의 어디에 있었는지 따라간다.
 * 이동은 한 병의 맨 위 몇 개만 옮기므로, 병마다 아래에서부터 같은 위치는 같은 블록이다.
 * 옮겨진 블록은 공개된 맨 위 블록이었으므로 이전 상태에서도 이미 공개돼 있다.
 */
function keepRevealed(prev: Bottle[], now: Bottle[]): Bottle[] {
  return prev.map((b, bi) =>
    b.map((cell, i) => (cell.revealed || !now[bi]?.[i]?.revealed || now[bi][i].typeId !== cell.typeId ? cell : { ...cell, revealed: true })),
  );
}

export function isSolved(state: GameState): boolean {
  return state.bottles.every(
    (b) => b.length === 0 || (b.length === state.capacity && b.every((c) => c.typeId === b[0].typeId)),
  );
}

/** 의미 있는 이동이 하나라도 있는지 (한 종류로 가득 찬 병을 빈 병으로 옮기는 것처럼 아무것도 안 바뀌는 이동은 뺀다) */
export function hasUsefulMove(state: GameState): boolean {
  const n = state.bottles.length;
  for (let from = 0; from < n; from++) {
    const src = state.bottles[from];
    if (src.length === 0) continue;
    const wholeSingle = topRun(src) === src.length;
    for (let to = 0; to < n; to++) {
      if (moveCount(state, from, to) === 0) continue;
      // 한 종류뿐인 병을 통째로 빈 병에 옮기는 것은 제자리걸음
      if (wholeSingle && state.bottles[to].length === 0) continue;
      return true;
    }
  }
  return false;
}

/** 클리어하지 못했는데 쓸모 있는 이동이 없다 */
export function isStuck(state: GameState): boolean {
  return !isSolved(state) && !hasUsefulMove(state);
}

export function resetGame(initial: GameState): GameState {
  return { ...initial, undoLeft: STAGE.UNDO_LIMIT, history: [], moves: 0 };
}

/** 이동 횟수 → 별 0~3 (클리어하면 최소 1) */
export function starsFor(moves: number, par: number): 1 | 2 | 3 {
  if (moves <= Math.ceil(par * STAGE.STAR3_RATIO)) return 3;
  if (moves <= Math.ceil(par * STAGE.STAR2_RATIO)) return 2;
  return 1;
}
