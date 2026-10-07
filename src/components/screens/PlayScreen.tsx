"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSave } from "../SaveProvider";
import { useBank } from "../SpriteStack";
import { useFocusOnMount } from "../useFocusOnMount";
import { useMediaQuery } from "../useMediaQuery";
import { Button, IconButton } from "../ui/Button";
import { Dialog } from "../ui/Dialog";
import { InlineMessage } from "../ui/InlineMessage";
import { PixelIcon } from "../ui/PixelIcon";
import { useToast } from "../ui/Toast";
import { STAGE } from "@/config/stage";
import { generateLevel } from "@/game/levels";
import { addSpareBottle, applyMove, canAddSpare, capacityOf, spareIndex, createGame, isSolved, isStuck, moveCount, resetGame, starsFor, undo, type Bottle, type GameState } from "@/game/rules";
import { recordClear } from "@/lib/progress";
import { drawScene, type Flight, type Landing, type SceneColors } from "@/render/board";
import { layoutBoard, type BoardLayout } from "@/render/layout";
import styles from "./PlayScreen.module.css";

type Props = {
  stage: number;
  onExit: () => void;
  onHome: () => void;
  onNext: (stage: number) => void;
};

const SELECT_MS = 160;
const FLIGHT_MS = 240;
const LAND_MS = 180;

function readColors(): SceneColors {
  const css = getComputedStyle(document.documentElement);
  const v = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback;
  return {
    ink: v("--color-line", "#3d2c5e"),
    // 외곽선 위에 덮어 그리므로 불투명해야 한다 (반투명이면 잉크가 비쳐 회색이 됨)
    glass: v("--color-surface", "#fffdf8"),
    glassShine: v("--color-sky", "#bfe3ff"),
    rim: v("--color-secondary", "#c9b6ff"),
    selected: v("--color-primary-strong", "#b0306a"),
    star: v("--color-butter", "#ffe39a"),
    starEdge: v("--color-line", "#3d2c5e"),
  };
}

function describeBottle(b: Bottle, capacity: number, cap: number, isSpare: boolean) {
  const spare = isSpare ? `여분 병(${cap}칸), ` : "";
  if (b.length === 0) return `${spare}비어 있음`;
  const items = b.map((c) => (c.revealed ? `${c.typeId + 1}번` : "가려진 블록")).join(", ");
  const done = b.length === capacity && b.every((c) => c.revealed && c.typeId === b[0].typeId);
  return `${spare}아래부터 ${items}${done ? ". 완성" : ""}`;
}

export function PlayScreen({ stage, onExit, onHome, onNext }: Props) {
  const { save, update } = useSave();
  const toast = useToast();
  const bank = useBank();
  const osReduce = useMediaQuery("(prefers-reduced-motion: reduce)");
  const reduceMotion = save.settings.reduceMotion || osReduce;
  const titleRef = useFocusOnMount<HTMLHeadingElement>();

  const level = useMemo(() => generateLevel(stage), [stage]);
  const initial = useMemo(() => createGame(level.bottles, level.capacity, level.hidden), [level]);
  const [game, setGame] = useState<GameState>(initial);
  const [selected, setSelected] = useState<number | null>(null);
  const [cleared, setCleared] = useState<{ stars: number; moves: number } | null>(null);

  const boxRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState<{ w: number; h: number; dpr: number } | null>(null);
  const colorsRef = useRef<SceneColors | null>(null);

  // 애니메이션 상태 (그리기 루프만 쓰므로 ref)
  const anim = useRef({
    lift: 0,
    liftTarget: 0,
    liftBottle: null as number | null,
    flight: null as (Flight & { start: number }) | null,
    landing: null as (Landing & { start: number }) | null,
    raf: 0,
    last: 0,
  });
  const gameRef = useRef(game);
  gameRef.current = game;

  // 판 크기
  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const measure = () => {
      const r = box.getBoundingClientRect();
      setSize({ w: Math.floor(r.width), h: Math.floor(r.height), dpr: Math.min(3, window.devicePixelRatio || 1) });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(box);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    colorsRef.current = readColors();
  }, [save.settings.mode]);

  const layout: BoardLayout | null = useMemo(() => {
    if (!size) return null;
    return layoutBoard(Math.round(size.w * size.dpr), Math.round(size.h * size.dpr), game.capacities, bank.cellW, bank.cellH);
  }, [size, game.capacities, bank.cellW, bank.cellH]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || !layout) return;
    const a = anim.current;
    drawScene(ctx, {
      state: gameRef.current,
      layout,
      bank,
      selected: a.liftBottle,
      lift: a.lift,
      flight: a.flight,
      landing: a.landing,
      showNumbers: save.settings.showNumbers,
      colors: colorsRef.current ?? readColors(),
    });
  }, [layout, bank, save.settings.showNumbers]);

  const tick = useCallback(
    (now: number) => {
      const a = anim.current;
      a.raf = 0;
      const dt = a.last ? now - a.last : 16;
      a.last = now;
      let active = false;
      if (a.lift !== a.liftTarget) {
        const step = dt / SELECT_MS;
        a.lift = a.liftTarget > a.lift ? Math.min(a.liftTarget, a.lift + step) : Math.max(a.liftTarget, a.lift - step);
        if (a.lift === 0 && a.liftTarget === 0) a.liftBottle = null;
        active = active || a.lift !== a.liftTarget;
      }
      if (a.flight) {
        a.flight.t = Math.min(1, (now - a.flight.start) / FLIGHT_MS);
        if (a.flight.t >= 1) {
          const f = a.flight;
          a.flight = null;
          a.landing = { bottle: f.to, fromIndex: f.toIndex, count: f.cells.length, t: 0, start: now };
        }
        active = true;
      }
      if (a.landing) {
        a.landing.t = Math.min(1, (now - a.landing.start) / LAND_MS);
        if (a.landing.t >= 1) a.landing = null;
        else active = true;
      }
      draw();
      if (active) a.raf = requestAnimationFrame(tick);
      else a.last = 0;
    },
    [draw],
  );

  const kick = useCallback(() => {
    const a = anim.current;
    if (!a.raf) {
      a.last = 0;
      a.raf = requestAnimationFrame(tick);
    }
  }, [tick]);

  // 캔버스 크기 맞추고 다시 그리기
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !size) return;
    canvas.width = Math.round(size.w * size.dpr);
    canvas.height = Math.round(size.h * size.dpr);
    canvas.style.width = `${canvas.width / size.dpr}px`;
    canvas.style.height = `${canvas.height / size.dpr}px`;
    draw();
  }, [size, draw]);

  useEffect(() => {
    draw();
  }, [game, draw]);

  useEffect(() => () => cancelAnimationFrame(anim.current.raf), []);

  /** 진행 중인 모션을 끝 상태로 (빠르게 연달아 누를 때) */
  const finishMotion = () => {
    const a = anim.current;
    a.flight = null;
    a.landing = null;
  };

  const setLift = (bottle: number | null) => {
    const a = anim.current;
    if (bottle === null) {
      a.liftTarget = 0;
      if (reduceMotion) {
        a.lift = 0;
        a.liftBottle = null;
      }
    } else {
      if (a.liftBottle !== bottle) a.lift = 0;
      a.liftBottle = bottle;
      a.liftTarget = 1;
      if (reduceMotion) a.lift = 1;
    }
    setSelected(bottle);
    kick();
  };

  const finishIfDone = (next: GameState) => {
    if (isSolved(next)) {
      const stars = starsFor(next.moves, level.par);
      update((s) => ({ ...s, progress: recordClear(s.progress, stage, stars) }));
      window.setTimeout(() => setCleared({ stars, moves: next.moves }), reduceMotion ? 0 : FLIGHT_MS + LAND_MS);
    }
  };

  const tapBottle = (i: number) => {
    if (cleared) return;
    finishMotion();
    const g = gameRef.current;
    const bottle = g.bottles[i];
    if (selected === null) {
      if (bottle.length === 0) return;
      setLift(i);
      return;
    }
    if (selected === i) {
      setLift(null);
      return;
    }
    const from = selected;
    const result = applyMove(g, from, i);
    if (!result) {
      // 못 옮기는 곳: 그 병에 블록이 있으면 그 병을 새로 고른다
      if (bottle.length > 0) {
        toast.announce(`${i + 1}번 병으로는 옮길 수 없어요. ${i + 1}번 병을 골랐어요.`);
        setLift(i);
      } else setLift(null);
      return;
    }
    const { state: next, move } = result;
    const a = anim.current;
    a.lift = 0;
    a.liftTarget = 0;
    a.liftBottle = null;
    setSelected(null);
    if (!reduceMotion) {
      const dst = next.bottles[move.to];
      a.flight = {
        cells: dst.slice(dst.length - move.count),
        from: move.from,
        to: move.to,
        fromIndex: g.bottles[move.from].length - move.count,
        toIndex: g.bottles[move.to].length,
        t: 0,
        start: performance.now(),
      };
    }
    gameRef.current = next;
    setGame(next);
    kick();
    toast.announce(`${from + 1}번 병에서 ${i + 1}번 병으로 ${move.count}개 옮겼어요. 이동 ${next.moves}번.`);
    finishIfDone(next);
  };

  const doUndo = () => {
    if (cleared) return;
    finishMotion();
    const prev = undo(gameRef.current);
    if (!prev) return;
    gameRef.current = prev;
    setGame(prev);
    setLift(null);
    toast.announce(`되돌렸어요. 되돌리기 ${prev.undoLeft}번 남았어요.`);
  };

  const doReset = () => {
    finishMotion();
    const fresh = resetGame(initial);
    gameRef.current = fresh;
    setGame(fresh);
    setCleared(null);
    setLift(null);
    toast.announce("처음부터 다시 시작했어요. 되돌리기 3번.");
  };

  /** 여분 칸 받기: 한 판 최대 4번(1칸 병 → 4칸 병), 이동으로 세지 않음, 다시하기하면 사라짐 */
  const doSpare = () => {
    if (cleared || !canAddSpare(gameRef.current)) return;
    finishMotion();
    const next = addSpareBottle(gameRef.current);
    gameRef.current = next;
    setGame(next);
    const left = STAGE.SPARE_MAX - next.spare;
    toast.announce(`${next.bottles.length}번 여분 병이 ${next.spare}칸이 됐어요. ${left ? `${left}번 더 받을 수 있어요.` : "더 받을 수 없어요."}`);
  };

  // 키보드 보조: Z 되돌리기, R 다시하기, Esc 선택 해제
  const keysRef = useRef({ doUndo, doReset, setLift, selected });
  keysRef.current = { doUndo, doReset, setLift, selected };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (document.querySelector("dialog[open]")) return;
      const k = keysRef.current;
      if (e.key === "z" || e.key === "Z") k.doUndo();
      else if (e.key === "r" || e.key === "R") k.doReset();
      else if (e.key === "Escape" && k.selected !== null) k.setLift(null);
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const stuck = !cleared && isStuck(game);
  const canUndo = game.undoLeft > 0 && game.history.length > 0;
  const infinite = stage > STAGE.FINITE_STAGE_COUNT;
  const dpr = size?.dpr ?? 1;
  const canTarget = (i: number) => selected !== null && selected !== i && moveCount(game, selected, i) > 0;

  return (
    <div className={styles.screen}>
      <header className={styles.hud}>
        <IconButton icon="back" label="스테이지 목록으로" onClick={onExit} />
        <div className={styles.title}>
          <h1 ref={titleRef} tabIndex={-1} className={styles.stage}>
            {infinite ? `무한 ${stage}` : `스테이지 ${stage}`}
          </h1>
          <p className={styles.moves} aria-live="off">
            이동 <strong>{game.moves}</strong>
            {level.hidden && <span className={styles.tag}>? 가림</span>}
          </p>
        </div>
        <div className={styles.tools}>
          <span className={styles.undoWrap}>
            <IconButton icon="undo" label={`되돌리기 (Z) · ${game.undoLeft}번 남음`} variant="secondary" disabled={!canUndo} onClick={doUndo} />
            <span className={styles.badge} aria-hidden="true">
              {game.undoLeft}
            </span>
          </span>
          <IconButton icon="reset" label="다시하기 (R)" onClick={doReset} />
        </div>
      </header>

      {level.hidden && game.moves === 0 && (
        <p className={styles.notice}>가림 스테이지: 병마다 맨 위 블록(같은 종류로 이어진 덩어리)만 보여요. 옮기면 아래가 드러나요.</p>
      )}
      {stage === 1 && game.moves === 0 && !level.hidden && (
        <p className={styles.notice}>병을 눌러 고르고, 옮길 병을 눌러요. 같은 종류끼리 한 병에 모으면 성공!</p>
      )}

      <div ref={boxRef} className={styles.board}>
        <canvas ref={canvasRef} className={styles.canvas} aria-hidden="true" />
        {layout && (
          <div className={styles.hits} role="group" aria-label="병">
            {layout.bottles.map((r) => {
              const b = game.bottles[r.index];
              const isSel = selected === r.index;
              // 누르는 영역: 병 + 위로 떠오르는 자리. 이웃 병과 겹치지 않게 옆은 1칸만 넓힌다
              const padX = layout.scale;
              const padTop = 8 * layout.scale;
              const padBottom = 2 * layout.scale;
              return (
                <button
                  key={r.index}
                  type="button"
                  className={`${styles.hit} ${canTarget(r.index) ? styles.target : ""}`}
                  style={{
                    left: (r.x - padX) / dpr,
                    top: (r.y - padTop) / dpr,
                    width: (r.w + padX * 2) / dpr,
                    height: (r.h + padTop + padBottom) / dpr,
                  }}
                  aria-pressed={isSel}
                  aria-label={`${r.index + 1}번 병: ${describeBottle(b, game.capacity, capacityOf(game, r.index), r.index === spareIndex(game))}${isSel ? ". 선택됨" : ""}`}
                  onClick={() => tapBottle(r.index)}
                />
              );
            })}
          </div>
        )}
      </div>

      <div className={styles.bottom}>
        {stuck && (
          <InlineMessage
            tone="warning"
            title="더 옮길 수 있는 게 없어요"
            action={
              <div className={styles.stuckActions}>
                <Button icon="undo" disabled={!canUndo} onClick={doUndo}>
                  되돌리기 ({game.undoLeft})
                </Button>
                {canAddSpare(game) && (
                  <Button icon="plus" onClick={doSpare}>
                    여분 칸
                  </Button>
                )}
                <Button variant="primary" icon="reset" onClick={doReset}>
                  다시하기
                </Button>
              </div>
            }
          >
            {canUndo || canAddSpare(game)
              ? "되돌리거나 여분 칸을 받아서 다른 길을 찾아보세요."
              : "처음부터 다시 해 보세요. 다시하면 되돌리기·여분 칸도 처음으로 돌아와요."}
          </InlineMessage>
        )}
        {!stuck && (
          <div className={styles.spareRow}>
            <Button
              variant="ghost"
              icon="plus"
              onClick={doSpare}
              disabled={cleared !== null || !canAddSpare(game)}
              aria-label={`${game.spare === 0 ? "여분 병 받기" : "여분 칸 늘리기"}, ${game.spare}/${STAGE.SPARE_MAX}칸 받음`}
            >
              {game.spare === 0 ? "여분 병 받기" : canAddSpare(game) ? "여분 칸 늘리기" : "여분 칸 다 받음"} ({game.spare}/{STAGE.SPARE_MAX})
            </Button>
          </div>
        )}
      </div>

      <Dialog
        open={cleared !== null}
        title="클리어!"
        onClose={onExit}
        actions={
          <>
            <Button variant="primary" size="lg" icon="play" data-autofocus onClick={() => onNext(stage + 1)}>
              {stage === STAGE.FINITE_STAGE_COUNT ? "무한 모드 시작" : "다음 스테이지"}
            </Button>
            <Button icon="reset" onClick={doReset}>
              다시하기
            </Button>
            <Button variant="ghost" icon="list" onClick={onExit}>
              스테이지 선택
            </Button>
            <Button variant="ghost" icon="back" onClick={onHome}>
              처음으로
            </Button>
          </>
        }
      >
        {cleared && (
          <div className={styles.result}>
            <p className={styles.resultStars} aria-label={`별 ${cleared.stars}개`}>
              {[1, 2, 3].map((k) => (
                <span key={k} className={k <= cleared.stars ? styles.bigStarOn : styles.bigStarOff} aria-hidden="true">
                  <PixelIcon name="star" size={36} />
                </span>
              ))}
            </p>
            <p className={styles.resultMoves}>
              이동 <strong>{cleared.moves}</strong>번
            </p>
            <p className={styles.resultHelp}>
              {cleared.stars < 3 ? `${Math.ceil(level.par * STAGE.STAR3_RATIO)}번 안에 깨면 별 3개!` : "완벽해요!"}
            </p>
          </div>
        )}
      </Dialog>
    </div>
  );
}
