"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { defaultSave, readSave, type SaveData } from "@/lib/save";

/** localStorage 키 (버전은 값 안의 version 필드로) */
export const STORAGE_KEY = "dot-jelly-sort.save";

type SaveApi = {
  save: SaveData;
  /** 저장 데이터를 바꾸고 바로 localStorage에 쓴다 */
  update: (fn: (prev: SaveData) => SaveData) => void;
  /** 저장소를 못 쓰는 환경(사생활 보호 모드 등)이면 false */
  persistent: boolean;
};

const SaveContext = createContext<SaveApi | null>(null);

function load(): { data: SaveData; persistent: boolean } {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return { data: raw ? readSave(JSON.parse(raw)) : defaultSave(), persistent: true };
  } catch {
    return { data: defaultSave(), persistent: false };
  }
}

export function SaveProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ data: SaveData; persistent: boolean } | null>(null);
  const latest = useRef<SaveData | null>(null);

  useEffect(() => {
    const loaded = load();
    latest.current = loaded.data;
    setState(loaded);
  }, []);

  const update = useCallback((fn: (prev: SaveData) => SaveData) => {
    const prev = latest.current;
    if (!prev) return;
    const next = fn(prev);
    if (next === prev) return;
    latest.current = next;
    let persistent = true;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      persistent = false;
    }
    setState({ data: next, persistent });
  }, []);

  const api = useMemo<SaveApi | null>(
    () => (state ? { save: state.data, update, persistent: state.persistent } : null),
    [state, update],
  );

  // 저장 데이터를 읽기 전에는 아무것도 그리지 않는다 (첫 화면 깜빡임 방지 — 아주 짧다)
  if (!api) return null;
  return <SaveContext.Provider value={api}>{children}</SaveContext.Provider>;
}

export function useSave(): SaveApi {
  const ctx = useContext(SaveContext);
  if (!ctx) throw new Error("useSave는 SaveProvider 안에서만 쓸 수 있습니다");
  return ctx;
}
