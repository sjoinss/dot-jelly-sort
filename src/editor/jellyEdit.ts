import { RECENT_COLORS } from "../lib/save";
import { clampInner, emptyInner, isEditable, JELLY_W, type Inner } from "../sprites/jelly";

/** 에디터에서 다루는 한 종류의 모습: 안쪽 도트 + 몸통 색 */
export type Draft = { inner: Inner; body: string };

/** 펜(색) / 지우개(null). 편집할 수 없는 칸이거나 그대로면 같은 객체를 돌려준다 */
export function paint(d: Draft, x: number, y: number, color: string | null): Draft {
  if (!isEditable(x, y)) return d;
  const i = y * JELLY_W + x;
  if (d.inner[i] === color) return d;
  const inner = d.inner.slice();
  inner[i] = color;
  return { ...d, inner };
}

/** 스포이드: 칠한 칸은 그 색, 아니면 몸통 색. 편집할 수 없는 칸이면 null */
export function pick(d: Draft, x: number, y: number): string | null {
  if (!isEditable(x, y)) return null;
  return d.inner[y * JELLY_W + x] ?? d.body;
}

/** 전체 지우기 (안쪽 도트만, 몸통 색은 그대로) */
export function clearInner(d: Draft): Draft {
  return d.inner.every((c) => c === null) ? d : { ...d, inner: emptyInner() };
}

export function applyPreset(d: Draft, inner: Inner): Draft {
  return { ...d, inner: clampInner(inner) };
}

/** 최근 사용 색: 맨 앞에, 중복 없이, 최대 RECENT_COLORS개 */
export function pushRecent(list: string[], color: string): string[] {
  const c = color.toLowerCase();
  if (list[0] === c) return list;
  return [c, ...list.filter((x) => x !== c)].slice(0, RECENT_COLORS);
}
