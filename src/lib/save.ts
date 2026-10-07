import { FACE } from "../sprites/block";
import { clampInner, DEFAULT_INNER, JELLY_H, JELLY_W, type Inner, type OutlineSetting } from "../sprites/jelly";

/**
 * 저장 데이터 (기획서 6-4, 9번). localStorage 한 키에 버전과 함께 둔다.
 * 불러올 때는 무엇이든 의심하고(파일·예전 버전·손으로 고친 값) 검증한 값만 쓴다. 마스크 밖 도트는 버린다.
 */

export const SAVE_VERSION = 1;
export const FILE_APP = "dot-jelly-sort";

export type Mode = "jelly" | "block";

export interface SpriteDef {
  mode: Mode;
  /** 젤리 16×14, 블록 8×8 */
  width: number;
  height: number;
  /** 젤리: 몸통 색. 블록: "" (얼굴에 다 들어 있음) */
  bodyColor: string;
  /** 젤리: 안쪽 도트(null = 몸통 색). 블록: 얼굴 64칸 */
  inner: (string | null)[];
  source?: "default" | "custom" | "skin";
  /** 블록: 스킨 이름(닉네임 또는 파일 이름) */
  name?: string;
}

export type Settings = {
  mode: Mode;
  outline: OutlineSetting;
  reduceMotion: boolean;
  showNumbers: boolean;
};

export type Progress = {
  /** 스테이지 번호 → 받은 별 (1~3) */
  stars: Record<string, number>;
  /** 클리어한 가장 높은 스테이지 */
  best: number;
};

export type SaveData = {
  version: number;
  settings: Settings;
  progress: Progress;
  jelly: {
    /** 모든 종류가 같이 쓰는 기본 디자인 (안쪽 도트만, 색은 종류별 자동) */
    base: Inner;
    /** 따로 편집한 종류 (typeId → 스프라이트) */
    types: Record<string, SpriteDef>;
    recentColors: string[];
  };
  block: {
    /** 스킨을 등록한 종류 */
    types: Record<string, SpriteDef>;
  };
};

export const MAX_TYPE_ID = 63;
export const RECENT_COLORS = 10;

export function defaultSave(): SaveData {
  return {
    version: SAVE_VERSION,
    settings: { mode: "jelly", outline: "black", reduceMotion: false, showNumbers: false },
    progress: { stars: {}, best: 0 },
    jelly: { base: DEFAULT_INNER.slice(), types: {}, recentColors: [] },
    block: { types: {} },
  };
}

// ── 검증 ──

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
export const isHex = (v: unknown): v is string => typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v);
const hexOrNull = (v: unknown) => (isHex(v) ? v.toLowerCase() : null);

function readInner(v: unknown): Inner | null {
  if (!Array.isArray(v) || v.length !== JELLY_W * JELLY_H) return null;
  return clampInner(v.map(hexOrNull));
}

export function readJellySprite(v: unknown): SpriteDef | null {
  if (!isObj(v) || v.mode !== "jelly" || v.width !== JELLY_W || v.height !== JELLY_H) return null;
  const inner = readInner(v.inner);
  if (!inner || !isHex(v.bodyColor)) return null;
  return { mode: "jelly", width: JELLY_W, height: JELLY_H, bodyColor: v.bodyColor.toLowerCase(), inner, source: "custom" };
}

export function readBlockSprite(v: unknown): SpriteDef | null {
  if (!isObj(v) || v.mode !== "block" || v.width !== FACE || v.height !== FACE) return null;
  if (!Array.isArray(v.inner) || v.inner.length !== FACE * FACE || !v.inner.every(isHex)) return null;
  const name = typeof v.name === "string" ? v.name.slice(0, 40) : undefined;
  return {
    mode: "block",
    width: FACE,
    height: FACE,
    bodyColor: "",
    inner: (v.inner as string[]).map((c) => c.toLowerCase()),
    source: "skin",
    ...(name ? { name } : {}),
  };
}

function readTypes(v: unknown, read: (s: unknown) => SpriteDef | null): { types: Record<string, SpriteDef>; dropped: number } {
  const types: Record<string, SpriteDef> = {};
  let dropped = 0;
  if (!isObj(v)) return { types, dropped };
  for (const [k, s] of Object.entries(v)) {
    const id = Number(k);
    const sprite = Number.isInteger(id) && id >= 0 && id <= MAX_TYPE_ID ? read(s) : null;
    if (sprite) types[String(id)] = sprite;
    else dropped++;
  }
  return { types, dropped };
}

function readSettings(v: unknown): Settings {
  const d = defaultSave().settings;
  if (!isObj(v)) return d;
  return {
    mode: v.mode === "block" ? "block" : "jelly",
    outline: v.outline === "white" || v.outline === "auto" ? v.outline : "black",
    reduceMotion: typeof v.reduceMotion === "boolean" ? v.reduceMotion : d.reduceMotion,
    showNumbers: typeof v.showNumbers === "boolean" ? v.showNumbers : d.showNumbers,
  };
}

function readProgress(v: unknown): Progress {
  const out: Progress = { stars: {}, best: 0 };
  if (!isObj(v)) return out;
  if (isObj(v.stars))
    for (const [k, s] of Object.entries(v.stars)) {
      const n = Number(k);
      if (Number.isInteger(n) && n >= 1 && n <= 1_000_000 && (s === 1 || s === 2 || s === 3)) out.stars[String(n)] = s;
    }
  const best = Number(v.best);
  out.best = Number.isInteger(best) && best >= 0 && best <= 1_000_000 ? best : 0;
  // 별 기록과 어긋나지 않게
  for (const k of Object.keys(out.stars)) out.best = Math.max(out.best, Number(k));
  return out;
}

/** localStorage에서 읽은 값 → 저장 데이터 (모르는 값은 기본값) */
export function readSave(raw: unknown): SaveData {
  const d = defaultSave();
  if (!isObj(raw)) return d;
  const jelly = isObj(raw.jelly) ? raw.jelly : {};
  const block = isObj(raw.block) ? raw.block : {};
  return {
    version: SAVE_VERSION,
    settings: readSettings(raw.settings),
    progress: readProgress(raw.progress),
    jelly: {
      base: readInner(jelly.base) ?? d.jelly.base,
      types: readTypes(jelly.types, readJellySprite).types,
      recentColors: Array.isArray(jelly.recentColors) ? jelly.recentColors.filter(isHex).slice(0, RECENT_COLORS) : [],
    },
    block: { types: readTypes(block.types, readBlockSprite).types },
  };
}

// ── 파일 (JSON 저장/불러오기) ──

export type SpriteFile = {
  app: typeof FILE_APP;
  kind: "sprites";
  version: number;
  exportedAt: string;
  settings: { outline: OutlineSetting; showNumbers: boolean };
  jelly: { base: SpriteDef; types: Record<string, SpriteDef> };
  block: { types: Record<string, SpriteDef> };
};

export function toFile(save: SaveData, now = new Date()): SpriteFile {
  return {
    app: FILE_APP,
    kind: "sprites",
    version: SAVE_VERSION,
    exportedAt: now.toISOString(),
    settings: { outline: save.settings.outline, showNumbers: save.settings.showNumbers },
    jelly: {
      base: { mode: "jelly", width: JELLY_W, height: JELLY_H, bodyColor: "#ffffff", inner: save.jelly.base, source: "default" },
      types: save.jelly.types,
    },
    block: { types: save.block.types },
  };
}

export const MAX_FILE_BYTES = 512 * 1024;

export type ImportResult =
  | { ok: true; base: Inner; jellyTypes: Record<string, SpriteDef>; blockTypes: Record<string, SpriteDef>; settings: SpriteFile["settings"]; dropped: number }
  | { ok: false; message: string };

/** 파일 내용(글자) → 검증된 스프라이트. 실패하면 이유를 사람이 읽을 문장으로 */
export function parseFile(text: string): ImportResult {
  if (text.length > MAX_FILE_BYTES) return { ok: false, message: "파일이 너무 커요. 이 게임에서 저장한 JSON 파일인지 확인해 주세요." };
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, message: "JSON 형식이 아니에요. 이 게임에서 저장한 파일을 골라 주세요." };
  }
  if (!isObj(raw) || raw.app !== FILE_APP || raw.kind !== "sprites") {
    return { ok: false, message: "도트 젤리 소팅에서 저장한 캐릭터 파일이 아니에요." };
  }
  if (typeof raw.version !== "number" || raw.version > SAVE_VERSION) {
    return { ok: false, message: "더 새로운 버전에서 만든 파일이에요. 게임을 새로고침한 뒤 다시 해 주세요." };
  }
  const jelly = isObj(raw.jelly) ? raw.jelly : {};
  const block = isObj(raw.block) ? raw.block : {};
  const baseSprite = isObj(jelly.base) ? readInner(jelly.base.inner) : null;
  const jt = readTypes(jelly.types, readJellySprite);
  const bt = readTypes(block.types, readBlockSprite);
  const s = readSettings(raw.settings);
  if (!baseSprite && Object.keys(jt.types).length === 0 && Object.keys(bt.types).length === 0) {
    return { ok: false, message: "파일에 불러올 캐릭터가 없어요." };
  }
  return {
    ok: true,
    base: baseSprite ?? DEFAULT_INNER.slice(),
    jellyTypes: jt.types,
    blockTypes: bt.types,
    settings: { outline: s.outline, showNumbers: s.showNumbers },
    dropped: jt.dropped + bt.dropped,
  };
}
