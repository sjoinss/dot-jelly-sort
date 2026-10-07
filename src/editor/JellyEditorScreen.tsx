"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ScreenLayout } from "@/components/screens/ScreenLayout";
import { useSave } from "@/components/SaveProvider";
import { SpriteStack, useBank } from "@/components/SpriteStack";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { PixelIcon, type PixelIconName } from "@/components/ui/PixelIcon";
import { useToast } from "@/components/ui/Toast";
import { STAGE } from "@/config/stage";
import type { SpriteDef } from "@/lib/save";
import { autoBodyColor, INK, JELLY_H, JELLY_W, jellyPixels, outlineColor, PRESETS, shadeOf } from "@/sprites/jelly";
import { ColorPicker } from "./ColorPicker";
import { createHistory, pushHistory, redo, replacePresent, undo, type History } from "./history";
import { JellyCanvas, type PointerPhase, type Tool } from "./JellyCanvas";
import { applyPreset, clearInner, paint, pick, pushRecent, type Draft } from "./jellyEdit";
import styles from "./JellyEditorScreen.module.css";
import toolStyles from "./Toolbar.module.css";

type Props = { onBack: () => void };

/** "base" = 모든 종류가 같이 쓰는 기본 디자인, 숫자 = 그 종류만 */
type Target = "base" | number;

/** 에디터에 보여줄 종류 수 (한 판에 나올 수 있는 최대) */
const TYPE_COUNT = STAGE.INFINITE_TYPES_MAX;

const TOOLS: { id: Tool; icon: PixelIconName; label: string; key: string }[] = [
  { id: "pen", icon: "pencil", label: "펜", key: "B" },
  { id: "eraser", icon: "eraser", label: "지우개", key: "E" },
  { id: "eyedropper", icon: "dropper", label: "스포이드", key: "I" },
];

export function JellyEditorScreen({ onBack }: Props) {
  const { save, update } = useSave();
  const toast = useToast();
  const [target, setTarget] = useState<Target>("base");
  const [tool, setTool] = useState<Tool>("pen");
  const [color, setColor] = useState<string>(INK);
  const [picking, setPicking] = useState<"pen" | "body" | null>(null);
  const [presetsOpen, setPresetsOpen] = useState(false);
  const [confirmRevert, setConfirmRevert] = useState(false);
  const cancelRevertRef = useRef<HTMLButtonElement>(null);

  const custom: SpriteDef | undefined = target === "base" ? undefined : save.jelly.types[target];
  const savedDraft = (): Draft =>
    target === "base"
      ? { inner: save.jelly.base, body: autoBodyColor(0) }
      : { inner: custom?.inner ?? save.jelly.base, body: custom?.bodyColor ?? autoBodyColor(target) };

  const [hist, setHist] = useState<History<Draft>>(() => createHistory(savedDraft()));
  const strokeStart = useRef<Draft | null>(null);
  const histRef = useRef(hist);
  histRef.current = hist;
  const draft = hist.present;
  /** 몸통 색 고르기: 열 때 모습과 고르는 중인 색 */
  const bodyStart = useRef<Draft | null>(null);
  const bodyLive = useRef("");

  // 대상을 바꾸면 그 대상의 저장된 모습에서 새로 시작 (되돌리기 기록도 따로)
  useEffect(() => {
    setHist(createHistory(savedDraft()));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 대상이 바뀔 때만
  }, [target]);

  /** 지금 모습을 저장 데이터에 쓴다 */
  const persist = (d: Draft) => {
    update((s) => {
      if (target === "base") return { ...s, jelly: { ...s.jelly, base: d.inner } };
      const sprite: SpriteDef = { mode: "jelly", width: JELLY_W, height: JELLY_H, bodyColor: d.body, inner: d.inner, source: "custom" };
      return { ...s, jelly: { ...s.jelly, types: { ...s.jelly.types, [target]: sprite } } };
    });
  };

  const remember = (c: string) => update((s) => ({ ...s, jelly: { ...s.jelly, recentColors: pushRecent(s.jelly.recentColors, c) } }));

  /** 붓질 한 번이 아닌 한 번에 끝나는 변경 (프리셋, 전체 지우기, 몸통 색) */
  const commit = (next: Draft) => {
    if (next === draft) return;
    setHist((h) => pushHistory(h, next));
    persist(next);
  };

  const onCell = (phase: PointerPhase, x: number, y: number) => {
    if (tool === "eyedropper") {
      if (phase !== "start") return;
      const c = pick(draft, x, y);
      if (c) {
        setColor(c);
        setTool("pen");
        toast.announce(`색 ${c}를 골랐어요. 펜으로 바꿨어요.`);
      }
      return;
    }
    const value = tool === "pen" ? color : null;
    if (phase === "start") {
      strokeStart.current = draft;
      const next = paint(draft, x, y, value);
      setHist((h) => (next === h.present ? h : pushHistory(h, next)));
      return;
    }
    if (phase === "move") {
      setHist((h) => replacePresent(h, paint(h.present, x, y, value)));
      return;
    }
    if (phase === "cancel") {
      const start = strokeStart.current;
      strokeStart.current = null;
      if (start) setHist((h) => (h.present === start ? h : { past: h.past.slice(0, -1), present: start, future: h.future }));
      return;
    }
    // end
    const start = strokeStart.current;
    strokeStart.current = null;
    const present = histRef.current.present;
    if (start && start !== present) {
      persist(present);
      if (tool === "pen") remember(color);
    }
  };

  const doUndo = () => {
    const h = undo(hist);
    if (h === hist) return;
    setHist(h);
    persist(h.present);
  };
  const doRedo = () => {
    const h = redo(hist);
    if (h === hist) return;
    setHist(h);
    persist(h.present);
  };

  // 단축키: Ctrl+Z / Ctrl+Y(Shift+Ctrl+Z), B·E·I 도구
  const keys = useRef({ doUndo, doRedo });
  keys.current = { doUndo, doRedo };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (document.querySelector("dialog[open]")) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) keys.current.doRedo();
        else keys.current.doUndo();
      } else if (mod && e.key.toLowerCase() === "y") {
        e.preventDefault();
        keys.current.doRedo();
      } else if (!mod && !e.altKey) {
        const tl = TOOLS.find((x) => x.key.toLowerCase() === e.key.toLowerCase());
        if (tl) setTool(tl.id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // 미리보기용: 지금 편집 중인 모습을 반영한 모습
  const previewOverride = useMemo(() => {
    if (target === "base") return { base: draft.inner };
    const sprite: SpriteDef = { mode: "jelly", width: JELLY_W, height: JELLY_H, bodyColor: draft.body, inner: draft.inner, source: "custom" };
    return { jellyTypes: { ...save.jelly.types, [target]: sprite } };
  }, [target, draft, save.jelly.types]);
  const previewBank = useBank({ ...previewOverride, mode: "jelly" });
  const chipBank = useBank({ mode: "jelly" });

  const outline = outlineColor(save.settings.outline, draft.body);
  const pixels = useMemo(
    () => jellyPixels(draft.inner, { body: draft.body, shade: shadeOf(draft.body), outline }, { connectUp: false, connectDown: false }),
    [draft, outline],
  );

  const previewType = target === "base" ? 0 : target;
  const recent = save.jelly.recentColors;
  const targetName = target === "base" ? "기본 디자인" : `${target + 1}번 젤리`;

  return (
    <ScreenLayout title="캐릭터 꾸미기" onBack={onBack} fill>
      <div className={styles.targets} role="radiogroup" aria-label="꾸밀 대상">
        <button type="button" role="radio" aria-checked={target === "base"} className={`${styles.chip} ${styles.baseChip}`} onClick={() => setTarget("base")}>
          기본 디자인
        </button>
        {Array.from({ length: TYPE_COUNT }, (_, t) => {
          const isCustom = !!save.jelly.types[t];
          return (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={target === t}
              aria-label={`${t + 1}번 젤리${isCustom ? ", 따로 꾸밈" : ""}`}
              title={`${t + 1}번 젤리${isCustom ? " (따로 꾸밈)" : ""}`}
              className={styles.chip}
              onClick={() => setTarget(t)}
            >
              <SpriteStack bank={chipBank} types={[t]} unit={2} label="" />
              <span className={styles.chipNum}>{t + 1}</span>
              {isCustom && <span className={styles.customDot} aria-hidden="true" />}
            </button>
          );
        })}
      </div>

      <p className={styles.status} aria-live="polite">
        {target === "base"
          ? "모든 종류가 함께 쓰는 얼굴이에요. 몸통 색은 종류마다 자동으로 달라져요."
          : custom
            ? `${targetName}: 따로 꾸민 디자인이에요.`
            : `${targetName}: 기본 디자인을 쓰는 중이에요. 고치면 이 종류만 따로 꾸며져요.`}
      </p>

      <div className={styles.work}>
        <JellyCanvas pixels={pixels} tool={tool} label={`${targetName} 확대 편집`} onCell={onCell} />
        <div className={styles.previews}>
          <figure className={styles.preview}>
            <SpriteStack bank={previewBank} types={[previewType]} unit={2} label={`${targetName} 실제 크기`} />
            <figcaption>실제 크기</figcaption>
          </figure>
          <figure className={styles.preview}>
            <SpriteStack bank={previewBank} types={[previewType, previewType, previewType]} unit={2} label={`${targetName} 3개가 이어진 모습`} />
            <figcaption>이어진 모습</figcaption>
          </figure>
          {target === "base" && (
            <figure className={styles.preview}>
              <SpriteStack bank={previewBank} types={[0, 1, 2]} unit={1} label="여러 색에 적용한 모습" />
              <figcaption>다른 색</figcaption>
            </figure>
          )}
        </div>
      </div>

      <div className={toolStyles.row} role="group" aria-label="도구">
        {TOOLS.map((t) => (
          <button key={t.id} type="button" className={toolStyles.tool} aria-pressed={tool === t.id} title={`${t.label} (${t.key})`} onClick={() => setTool(t.id)}>
            <PixelIcon name={t.icon} size={20} />
            <span className={toolStyles.label}>{t.label}</span>
          </button>
        ))}
        <button type="button" className={toolStyles.tool} title="되돌리기 (Ctrl+Z)" disabled={hist.past.length === 0} onClick={doUndo}>
          <PixelIcon name="undo" size={20} />
          <span className={toolStyles.label}>되돌림</span>
        </button>
        <button type="button" className={toolStyles.tool} title="다시 하기 (Ctrl+Y)" disabled={hist.future.length === 0} onClick={doRedo}>
          <PixelIcon name="redo" size={20} />
          <span className={toolStyles.label}>다시</span>
        </button>
        <button type="button" className={toolStyles.tool} title="안쪽 도트 전체 지우기 (되돌리기 가능)" onClick={() => commit(clearInner(draft))}>
          <PixelIcon name="trash" size={20} />
          <span className={toolStyles.label}>지우기</span>
        </button>
      </div>

      <div className={styles.colors}>
        <button type="button" className={styles.current} title="펜 색 고르기" aria-haspopup="dialog" onClick={() => setPicking("pen")}>
          <span className={styles.swatchFill} style={{ background: color }} aria-hidden="true" />
          <span className="visually-hidden">펜 색 {color}. 눌러서 다른 색 고르기</span>
        </button>
        <ul className={styles.recent} aria-label="최근 사용 색">
          {[INK, "#ffffff", ...recent.filter((c) => c !== INK && c !== "#ffffff")].slice(0, 10).map((c) => (
            <li key={c}>
              <button
                type="button"
                className={styles.swatch}
                style={{ background: c }}
                aria-pressed={c === color}
                aria-label={c}
                title={c}
                onClick={() => {
                  setColor(c);
                  if (tool !== "pen") setTool("pen");
                }}
              />
            </li>
          ))}
        </ul>
      </div>

      <div className={styles.actions}>
        {target !== "base" && (
          <Button
            icon="fill"
            onClick={() => {
              bodyStart.current = draft;
              bodyLive.current = draft.body;
              setPicking("body");
            }}
          >
            <span className={styles.bodyLabel}>
              몸통 색 <span className={styles.bodyDot} style={{ background: draft.body }} aria-hidden="true" />
            </span>
          </Button>
        )}
        <Button icon="heart" onClick={() => setPresetsOpen(true)}>
          프리셋
        </Button>
        {target !== "base" && custom && (
          <Button variant="ghost" icon="reset" onClick={() => setConfirmRevert(true)}>
            기본으로
          </Button>
        )}
      </div>

      <ColorPicker
        open={picking === "pen"}
        color={color}
        onChange={setColor}
        onClose={() => {
          setPicking(null);
          if (tool !== "pen") setTool("pen");
        }}
      />
      <ColorPicker
        open={picking === "body"}
        color={draft.body}
        onChange={(c) => {
          bodyLive.current = c;
          setHist((h) => replacePresent(h, { ...h.present, body: c }));
        }}
        onClose={() => {
          setPicking(null);
          // 고르는 동안은 기록 없이 바꾸다가 닫을 때 한 번만 기록·저장 (취소하면 원래 색이라 기록 없음)
          const start = bodyStart.current;
          const c = bodyLive.current;
          bodyStart.current = null;
          if (!start || c === start.body) return;
          const next = { ...start, body: c };
          setHist((h) => ({ past: [...h.past, start].slice(-100), present: next, future: [] }));
          persist(next);
          remember(c);
        }}
      />

      <Dialog open={presetsOpen} title="프리셋" description="눈·입·볼터치 세트를 골라요. 지금 그린 안쪽 도트는 바뀌어요 (되돌리기 가능)." onClose={() => setPresetsOpen(false)}>
        <ul className={styles.presets}>
          {PRESETS.map((p) => (
            <li key={p.id}>
              <PresetButton
                name={p.name}
                inner={p.inner}
                body={draft.body}
                outline={outline}
                onPick={() => {
                  commit(applyPreset(draft, p.inner));
                  setPresetsOpen(false);
                  toast.show(`"${p.name}" 프리셋을 적용했어요.`, "success");
                }}
              />
            </li>
          ))}
        </ul>
      </Dialog>

      <Dialog
        open={confirmRevert}
        title="기본으로 되돌리기"
        description={`${targetName}의 따로 꾸민 디자인을 지우고 기본 디자인과 자동 색으로 돌아가요.`}
        onClose={() => setConfirmRevert(false)}
        initialFocusRef={cancelRevertRef}
        actions={
          <>
            <Button
              variant="danger"
              icon="reset"
              onClick={() => {
                if (target === "base") return;
                update((s) => {
                  const types = { ...s.jelly.types };
                  delete types[target];
                  return { ...s, jelly: { ...s.jelly, types } };
                });
                setHist(createHistory({ inner: save.jelly.base, body: autoBodyColor(target) }));
                setConfirmRevert(false);
                toast.show(`${targetName}을 기본 디자인으로 되돌렸어요.`, "success");
              }}
            >
              되돌리기
            </Button>
            <Button ref={cancelRevertRef} onClick={() => setConfirmRevert(false)}>
              취소
            </Button>
          </>
        }
      />
    </ScreenLayout>
  );
}

function PresetButton({ name, inner, body, outline, onPick }: { name: string; inner: Draft["inner"]; body: string; outline: string; onPick: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    const px = jellyPixels(inner, { body, shade: shadeOf(body), outline }, { connectUp: false, connectDown: false });
    const s = 4;
    c.width = JELLY_W * s;
    c.height = JELLY_H * s;
    px.forEach((col, i) => {
      if (!col) return;
      ctx.fillStyle = col;
      ctx.fillRect((i % JELLY_W) * s, Math.floor(i / JELLY_W) * s, s, s);
    });
  }, [inner, body, outline]);
  return (
    <button type="button" className={styles.preset} onClick={onPick}>
      <canvas ref={ref} aria-hidden="true" style={{ width: JELLY_W * 3, height: JELLY_H * 3 }} />
      <span>{name}</span>
    </button>
  );
}
