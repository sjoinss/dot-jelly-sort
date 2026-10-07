import { STAGE } from "../config/stage";
import type { Progress } from "./save";

/** 플레이 버튼이 여는 스테이지: 아직 못 깬 첫 스테이지 (깬 가장 높은 번호 + 1) */
export function nextStage(p: Progress) {
  return Math.max(1, p.best + 1);
}

/** 이 스테이지를 열 수 있는지: 깬 스테이지 바로 다음까지 */
export function isUnlocked(p: Progress, stage: number) {
  return stage <= p.best + 1;
}

/** 무한 모드 진입: 일반 스테이지를 다 깼으면 다음 무한 스테이지, 아니면 잠김 */
export function infiniteUnlocked(p: Progress) {
  return p.best >= STAGE.FINITE_STAGE_COUNT;
}

export function recordClear(p: Progress, stage: number, stars: number): Progress {
  const key = String(stage);
  const prev = p.stars[key] ?? 0;
  return {
    stars: stars > prev ? { ...p.stars, [key]: stars } : p.stars,
    best: Math.max(p.best, stage),
  };
}

export function totalStars(p: Progress) {
  return Object.values(p.stars).reduce((a, b) => a + b, 0);
}
