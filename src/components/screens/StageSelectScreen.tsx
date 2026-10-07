"use client";

import { ScreenLayout } from "./ScreenLayout";
import { useSave } from "../SaveProvider";
import { Button } from "../ui/Button";
import { PixelIcon } from "../ui/PixelIcon";
import { STAGE } from "@/config/stage";
import { infiniteUnlocked, isUnlocked } from "@/lib/progress";
import styles from "./StageSelectScreen.module.css";

type Props = { onBack: () => void; onPick: (stage: number) => void };

export function StageSelectScreen({ onBack, onPick }: Props) {
  const { save } = useSave();
  const p = save.progress;
  const stages = Array.from({ length: STAGE.FINITE_STAGE_COUNT }, (_, i) => i + 1);
  const infiniteOpen = infiniteUnlocked(p);
  const infiniteStage = Math.max(STAGE.FINITE_STAGE_COUNT + 1, p.best + 1);

  return (
    <ScreenLayout title="스테이지" onBack={onBack}>
      <div className={styles.wrap}>
        <ol className={styles.grid} aria-label="스테이지 목록">
          {stages.map((n) => {
            const stars = p.stars[String(n)] ?? 0;
            const open = isUnlocked(p, n);
            const hidden = STAGE.HIDDEN_STAGES.includes(n);
            const label = open
              ? `스테이지 ${n}${hidden ? ", 가림" : ""}${stars ? `, 별 ${stars}개` : n === p.best + 1 ? ", 다음 차례" : ""}`
              : `스테이지 ${n}, 잠김`;
            return (
              <li key={n}>
                <button
                  type="button"
                  className={`${styles.stage} ${n === p.best + 1 ? styles.current : ""}`}
                  disabled={!open}
                  aria-label={label}
                  title={label}
                  onClick={() => onPick(n)}
                >
                  {open ? <span className={styles.num}>{n}</span> : <PixelIcon name="lock" size={18} />}
                  {open && (
                    <span className={styles.stars} aria-hidden="true">
                      {[1, 2, 3].map((k) => (
                        <span key={k} className={k <= stars ? styles.starOn : styles.starOff}>
                          <PixelIcon name="star" size={10} />
                        </span>
                      ))}
                    </span>
                  )}
                  {hidden && open && (
                    <span className={styles.hiddenTag} aria-hidden="true">
                      ?
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ol>

        <section className={styles.infinite} aria-labelledby="infinite-title">
          <div className={styles.infiniteText}>
            <h2 id="infinite-title" className={styles.infiniteTitle}>
              <PixelIcon name="infinity" size={20} /> 무한 모드
            </h2>
            <p className={styles.help}>
              {infiniteOpen
                ? `끝없이 이어지는 스테이지. 가끔 "?" 가림 판이 나와요. 다음은 ${infiniteStage}번.`
                : `스테이지 ${STAGE.FINITE_STAGE_COUNT}까지 깨면 열려요. (지금 ${p.best}/${STAGE.FINITE_STAGE_COUNT})`}
            </p>
          </div>
          <Button variant="primary" icon={infiniteOpen ? "play" : "lock"} disabled={!infiniteOpen} onClick={() => onPick(infiniteStage)}>
            {infiniteOpen ? "시작" : "잠김"}
          </Button>
        </section>
      </div>
    </ScreenLayout>
  );
}
