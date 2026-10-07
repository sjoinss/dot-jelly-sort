"use client";

import { useFocusOnMount } from "../useFocusOnMount";
import { useSave } from "../SaveProvider";
import { SpriteStack, useBank } from "../SpriteStack";
import { Button, IconButton } from "../ui/Button";
import { PixelIcon } from "../ui/PixelIcon";
import { Segmented } from "../ui/Segmented";
import { STAGE } from "@/config/stage";
import { nextStage, totalStars } from "@/lib/progress";
import type { Mode } from "@/lib/save";
import styles from "./MainScreen.module.css";

type Props = {
  onPlay: () => void;
  onStages: () => void;
  onEditor: () => void;
  onSettings: () => void;
};

/** 장식용 병 네 개: 같은 종류가 이어진 모습을 바로 보여준다 */
const DECOR: number[][] = [[0, 0, 1], [1, 2, 2], [2, 0], [3, 3, 3]];

export function MainScreen({ onPlay, onStages, onEditor, onSettings }: Props) {
  const { save, update } = useSave();
  const bank = useBank();
  const titleRef = useFocusOnMount<HTMLHeadingElement>();
  const mode = save.settings.mode;
  const stage = nextStage(save.progress);
  const infinite = stage > STAGE.FINITE_STAGE_COUNT;
  const stars = totalStars(save.progress);

  const setMode = (m: Mode) => update((s) => ({ ...s, settings: { ...s.settings, mode: m } }));

  return (
    <div className={styles.screen}>
      <header className={styles.top}>
        <span className={styles.stars} aria-label={`모은 별 ${stars}개`}>
          <PixelIcon name="star" size={18} />
          <span aria-hidden="true">{stars}</span>
        </span>
        <IconButton icon="gear" label="설정" onClick={onSettings} />
      </header>

      <main className={styles.main}>
        <h1 ref={titleRef} tabIndex={-1} className={styles.logo}>
          <span className={styles.logoSmall}>{mode === "jelly" ? "도트 젤리" : "도트 블록"}</span>
          <span className={styles.logoMain}>소팅</span>
        </h1>

        <div className={styles.decor} aria-hidden="true">
          {DECOR.map((types, i) => (
            <div key={i} className={styles.decorBottle}>
              <SpriteStack bank={bank} types={types} unit={mode === "jelly" ? 3 : 2} label="" />
            </div>
          ))}
        </div>

        <div className={styles.actions}>
          <Button variant="primary" size="lg" block icon="play" onClick={onPlay}>
            {infinite ? `무한 모드 ${stage}` : `스테이지 ${stage}`}
          </Button>
          <Button variant="secondary" block icon="list" onClick={onStages}>
            스테이지 선택
          </Button>
          <Button variant="ghost" block icon={mode === "jelly" ? "pencil" : "download"} onClick={onEditor}>
            {mode === "jelly" ? "캐릭터 꾸미기" : "스킨 불러오기"}
          </Button>
        </div>

        <div className={styles.mode}>
          <Segmented<Mode>
            label="모드"
            options={[
              { value: "jelly", label: "젤리 모드" },
              { value: "block", label: "마크 모드" },
            ]}
            value={mode}
            onChange={setMode}
          />
          <p className={styles.modeHelp}>
            {mode === "jelly" ? "말랑한 젤리로 플레이해요. 눈·입·색을 직접 찍을 수 있어요." : "네모난 머리 블록으로 플레이해요. 마크 스킨을 불러와 쓸 수 있어요."}
          </p>
        </div>
      </main>
    </div>
  );
}
