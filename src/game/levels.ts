import { STAGE } from "../config/stage";
import { createRng, hashSeed, type Rng } from "./rng";

/**
 * 레벨 생성 (기획서 5번). 스테이지 번호 → 시드 → 항상 같은 레벨.
 *
 * 해결 가능 보장: 기획서는 "완성 상태에서 이동의 역연산으로 섞기"였지만, 역방향 이동은 제약이 커서
 * "병이 전부 가득 차거나 빈" 시작 모양에 거의 닿지 못한다(시뮬레이션 100번 중 0~17번).
 * 그래서 시드로 섞어 담은 뒤 풀이기(solve)로 실제 풀이를 찾은 판만 쓴다 — 찾은 풀이를 거꾸로 따라가면
 * 완성 상태에서 역방향으로 섞은 것과 같아서 보장 수준은 같다. 풀이 길이는 별 기준(par)으로도 쓴다.
 */

export type StageParams = {
  stage: number;
  types: number;
  empty: number;
  capacity: number;
  hidden: boolean;
  infinite: boolean;
};

export type Level = StageParams & {
  /** 각 병: 아래→위 typeId */
  bottles: number[][];
  /** 찾은 풀이의 이동 수 (최소는 아닐 수 있음) */
  par: number;
  /** 생성에 실패해 대신 쓴 쉬운 판 (테스트에서 한 번도 나오지 않아야 한다) */
  fallback?: true;
};

export function isInfinite(stage: number) {
  return stage > STAGE.FINITE_STAGE_COUNT;
}

/** 무한 모드 가림 확률 (10% → 최대 20%) */
export function hiddenChance(stage: number) {
  const k = Math.floor(Math.max(0, stage - STAGE.FINITE_STAGE_COUNT - 1) / STAGE.HIDDEN_CHANCE_STEP_EVERY);
  return Math.min(STAGE.HIDDEN_CHANCE_MAX, STAGE.HIDDEN_CHANCE_START + k * STAGE.HIDDEN_CHANCE_STEP);
}

export function stageParams(stage: number): StageParams {
  const s = Math.max(1, Math.floor(stage));
  const base = { stage: s, empty: STAGE.EMPTY_BOTTLES, capacity: STAGE.CAPACITY };
  if (!isInfinite(s)) {
    const types = Math.min(STAGE.TYPES_MAX, STAGE.TYPES_MIN + Math.floor((s - 1) / STAGE.TYPES_STEP));
    return { ...base, types, hidden: STAGE.HIDDEN_STAGES.includes(s), infinite: false };
  }
  const rng = createRng(hashSeed(s, 0x51ed));
  const k = Math.floor((s - STAGE.FINITE_STAGE_COUNT - 1) / STAGE.INFINITE_TYPES_STEP);
  const top = Math.min(STAGE.INFINITE_TYPES_MAX, STAGE.INFINITE_TYPES_MIN + k);
  const types = Math.max(STAGE.INFINITE_TYPES_MIN - 1, top - Math.floor(rng() * 2));
  return { ...base, types, hidden: rng() < hiddenChance(s), infinite: true };
}

const cache = new Map<number, Level>();

export function generateLevel(stage: number): Level {
  const hit = cache.get(stage);
  if (hit) return hit;
  const params = stageParams(stage);
  const rng = createRng(hashSeed(params.stage, 0xb0771e));
  for (let attempt = 0; attempt < 200; attempt++) {
    const bottles = deal(params, rng);
    if (!acceptable(bottles, params)) continue;
    const solution = solve(bottles, params.capacity);
    if (!solution) continue;
    const level = { ...params, bottles, par: solution.length };
    cache.set(stage, level);
    return level;
  }
  // 이론상 오지 않는다 (테스트로 1~400번, 수동으로 1~3000번을 확인). 그래도 풀 수 있는 판을 돌려준다: 완성 상태에서 한 번 섞은 판
  const fallback = fallbackLevel(params);
  cache.set(stage, fallback);
  return fallback;
}

function deal(p: StageParams, rng: Rng): number[][] {
  const pool: number[] = [];
  for (let t = 0; t < p.types; t++) for (let i = 0; i < p.capacity; i++) pool.push(t);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const bottles: number[][] = [];
  for (let b = 0; b < p.types; b++) bottles.push(pool.slice(b * p.capacity, (b + 1) * p.capacity));
  for (let e = 0; e < p.empty; e++) bottles.push([]);
  return bottles;
}

/** 시작부터 너무 정렬돼 있으면 다시 섞는다 */
function acceptable(bottles: number[][], p: StageParams) {
  let sorted = 0;
  let longRuns = 0;
  for (const b of bottles) {
    if (b.length === p.capacity && b.every((t) => t === b[0])) sorted++;
    for (let i = 0; i + 2 < b.length; i++) if (b[i] === b[i + 1] && b[i] === b[i + 2]) longRuns++;
  }
  // 시작부터 다 맞춘 병은 없게, 같은 종류 3개 연속은 종류 수의 1/4까지만
  return sorted === 0 && longRuns <= Math.floor(p.types / 4);
}

function fallbackLevel(p: StageParams): Level {
  const bottles: number[][] = [];
  for (let t = 0; t < p.types; t++) bottles.push(new Array(p.capacity).fill(t));
  for (let e = 0; e < p.empty; e++) bottles.push([]);
  // 첫 두 병의 맨 위를 하나씩 빈 병으로 옮긴 상태 (두 번 옮기면 클리어)
  if (p.empty > 0 && p.types >= 2) {
    bottles[p.types].push(bottles[0].pop()!);
    bottles[p.types + (p.empty > 1 ? 1 : 0)].push(bottles[1].pop()!);
  }
  return { ...p, bottles, par: 2, fallback: true };
}

// ── 풀이기 ──

type Plan = [from: number, to: number][];

function key(bottles: number[][]) {
  // 병 순서는 상관없으니 정렬해서 같은 상태를 한 번만 본다
  return bottles
    .map((b) => b.join(","))
    .sort()
    .join("|");
}

function run(b: number[]) {
  if (b.length === 0) return 0;
  const t = b[b.length - 1];
  let n = 0;
  for (let i = b.length - 1; i >= 0 && b[i] === t; i--) n++;
  return n;
}

function solvedState(bottles: number[][], cap: number) {
  return bottles.every((b) => b.length === 0 || (b.length === cap && b.every((t) => t === b[0])));
}

/**
 * 깊이 우선 탐색 + 방문 기록. 좋은 이동(같은 종류 위로, 병을 완성하는 이동)부터 본다.
 * 찾지 못하면(탐색 한도 초과 포함) null.
 */
export function solve(start: number[][], cap: number, limit = 150_000): Plan | null {
  const seen = new Set<string>();
  const plan: Plan = [];
  let budget = limit;

  const candidates = (s: number[][]) => {
    const out: { from: number; to: number; score: number }[] = [];
    for (let from = 0; from < s.length; from++) {
      const src = s[from];
      if (src.length === 0) continue;
      const r = run(src);
      const t = src[src.length - 1];
      const single = r === src.length;
      for (let to = 0; to < s.length; to++) {
        if (to === from) continue;
        const dst = s[to];
        const space = cap - dst.length;
        if (space === 0) continue;
        if (dst.length === 0) {
          // 한 종류뿐인 병을 빈 병으로: 제자리걸음. 빈 병은 서로 같으니 한 곳만 본다
          if (single) continue;
          out.push({ from, to, score: 0 });
          continue;
        }
        if (dst[dst.length - 1] !== t) continue;
        const moved = Math.min(r, space);
        const completes = dst.length + moved === cap && run(dst) === dst.length;
        out.push({ from, to, score: (completes ? 4 : 2) + (moved === r ? 1 : 0) });
      }
    }
    // 빈 병으로 가는 이동은 출발 병마다 첫 빈 병만
    const filtered = out.filter((m) => {
      if (s[m.to].length !== 0) return true;
      const firstEmpty = s.findIndex((b) => b.length === 0);
      return m.to === firstEmpty;
    });
    return filtered.sort((a, b) => b.score - a.score);
  };

  const dfs = (s: number[][]): boolean => {
    if (solvedState(s, cap)) return true;
    if (--budget <= 0) return false;
    const k = key(s);
    if (seen.has(k)) return false;
    seen.add(k);
    for (const m of candidates(s)) {
      const next = s.slice();
      const src = next[m.from];
      const moved = Math.min(run(src), cap - next[m.to].length);
      next[m.from] = src.slice(0, src.length - moved);
      next[m.to] = [...next[m.to], ...src.slice(src.length - moved)];
      plan.push([m.from, m.to]);
      if (dfs(next)) return true;
      plan.pop();
      if (budget <= 0) return false;
    }
    return false;
  };

  return dfs(start.map((b) => b.slice())) ? plan : null;
}
