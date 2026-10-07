"use client";

import { useRef, useState } from "react";
import { ScreenLayout } from "./ScreenLayout";
import { useSave } from "../SaveProvider";
import { useSavedFlag } from "../useSavedFlag";
import { Button } from "../ui/Button";
import { Dialog } from "../ui/Dialog";
import { InlineMessage } from "../ui/InlineMessage";
import { Segmented } from "../ui/Segmented";
import { Switch } from "../ui/Switch";
import { useToast } from "../ui/Toast";
import { downloadedMessage, DOWNLOAD_TOAST_MS, saveOrShareFile } from "@/lib/fileIO";
import { parseFile, toFile, type ImportResult, type Mode } from "@/lib/save";
import type { OutlineSetting } from "@/sprites/jelly";
import styles from "./SettingsScreen.module.css";

type Props = { onBack: () => void };

function fileName(now = new Date()) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `jelly-sort-${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}.json`;
}

export function SettingsScreen({ onBack }: Props) {
  const { save, update, persistent } = useSave();
  const toast = useToast();
  const { saved, mark } = useSavedFlag();
  const s = save.settings;
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<Extract<ImportResult, { ok: true }> | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const cancelImportRef = useRef<HTMLButtonElement>(null);

  const set = (patch: Partial<typeof s>) => update((d) => ({ ...d, settings: { ...d.settings, ...patch } }));

  const exportFile = async () => {
    const name = fileName();
    const blob = new Blob([JSON.stringify(toFile(save), null, 1)], { type: "application/json" });
    const outcome = await saveOrShareFile(blob, name, false);
    if (outcome === "downloaded") {
      mark("json");
      toast.show(downloadedMessage(name), "success", DOWNLOAD_TOAST_MS);
    }
  };

  const onFile = async (file: File | undefined) => {
    setImportError(null);
    if (!file) return;
    const result = parseFile(await file.text());
    if (!result.ok) {
      setImportError(result.message);
      toast.show(result.message, "error");
      return;
    }
    setPending(result);
  };

  const applyImport = () => {
    if (!pending) return;
    update((d) => ({
      ...d,
      settings: { ...d.settings, ...pending.settings },
      jelly: { ...d.jelly, base: pending.base, types: pending.jellyTypes },
      block: { types: pending.blockTypes },
    }));
    const n = Object.keys(pending.jellyTypes).length;
    const m = Object.keys(pending.blockTypes).length;
    const dropped = pending.dropped ? ` (잘못된 ${pending.dropped}개는 뺐어요)` : "";
    toast.show(`불러왔어요! 젤리 개별 디자인 ${n}종 · 마크 스킨 ${m}종${dropped}`, "success");
    setPending(null);
  };

  return (
    <ScreenLayout title="설정" onBack={onBack}>
      <div className={styles.sections}>
        {!persistent && (
          <InlineMessage tone="warning" title="저장이 안 되는 환경이에요">
            사생활 보호 모드 등에서는 진행도와 캐릭터가 저장되지 않아요. 캐릭터는 JSON 파일로 저장해 두세요.
          </InlineMessage>
        )}

        <section className={`${styles.section} ${styles.card}`} aria-labelledby="set-mode">
          <h2 id="set-mode" className={styles.sectionTitle}>
            모드
          </h2>
          <Segmented<Mode>
            label="플레이 모드"
            showLabel={false}
            options={[
              { value: "jelly", label: "젤리 모드" },
              { value: "block", label: "마크 모드" },
            ]}
            value={s.mode}
            onChange={(mode) => set({ mode })}
          />
        </section>

        <section className={`${styles.section} ${styles.card}`} aria-labelledby="set-look">
          <h2 id="set-look" className={styles.sectionTitle}>
            보기
          </h2>
          <Segmented<OutlineSetting>
            label="외곽선 색"
            options={[
              { value: "black", label: "검정" },
              { value: "white", label: "흰색" },
              { value: "auto", label: "자동" },
            ]}
            value={s.outline}
            onChange={(outline) => set({ outline })}
          />
          <p className={styles.sectionHelp}>자동: 몸통이 아주 어두운 종류만 흰 선으로 그려요.</p>
          <div className={styles.switches}>
            <Switch
              label="종류 번호 표시"
              description="블록마다 번호를 붙여 색만으로 구분하지 않게 해요"
              checked={s.showNumbers}
              onChange={(showNumbers) => set({ showNumbers })}
            />
            <Switch
              label="모션 줄이기"
              description="블록이 날아가고 말랑하게 눌리는 움직임을 끄고 바로 옮겨요"
              checked={s.reduceMotion}
              onChange={(reduceMotion) => set({ reduceMotion })}
            />
          </div>
        </section>

        <section className={`${styles.section} ${styles.card}`} aria-labelledby="set-data">
          <h2 id="set-data" className={styles.sectionTitle}>
            캐릭터 파일
          </h2>
          <p className={styles.sectionHelp}>
            꾸민 젤리(기본 디자인·종류별 디자인)와 불러온 마크 스킨을 JSON 파일로 저장해 다른 브라우저로 옮기거나 친구와 나눌 수 있어요.
          </p>
          <div className={styles.row}>
            <Button icon={saved === "json" ? "check" : "download"} disabled={saved === "json"} onClick={exportFile}>
              {saved === "json" ? "저장 완료" : "JSON 저장"}
            </Button>
            <Button icon="upload" onClick={() => fileRef.current?.click()}>
              JSON 불러오기
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="visually-hidden"
              tabIndex={-1}
              aria-hidden="true"
              onChange={(e) => {
                void onFile(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </div>
          {importError && (
            <InlineMessage tone="error" title="불러오지 못했어요">
              {importError}
            </InlineMessage>
          )}
        </section>

        <section className={`${styles.section} ${styles.card}`} aria-labelledby="set-progress">
          <h2 id="set-progress" className={styles.sectionTitle}>
            진행도
          </h2>
          <p className={styles.sectionHelp}>깬 스테이지 {save.progress.best}개 · 초기화해도 캐릭터는 지워지지 않아요.</p>
          <div className={styles.danger}>
            <Button variant="danger" icon="trash" onClick={() => setConfirmReset(true)}>
              진행도 초기화
            </Button>
          </div>
        </section>
      </div>

      <Dialog
        open={pending !== null}
        title="캐릭터 불러오기"
        description="지금 꾸민 젤리와 불러온 스킨이 파일 내용으로 바뀌어요. 진행도는 그대로예요."
        onClose={() => setPending(null)}
        initialFocusRef={cancelImportRef}
        actions={
          <>
            <Button variant="primary" icon="check" onClick={applyImport}>
              바꾸기
            </Button>
            <Button ref={cancelImportRef} onClick={() => setPending(null)}>
              취소
            </Button>
          </>
        }
      >
        {pending && (
          <p className={styles.sectionHelp}>
            파일 안: 젤리 개별 디자인 {Object.keys(pending.jellyTypes).length}종 · 마크 스킨 {Object.keys(pending.blockTypes).length}종
          </p>
        )}
      </Dialog>

      <Dialog
        open={confirmReset}
        title="진행도 초기화"
        description="깬 스테이지와 별이 모두 지워지고 1스테이지부터 다시 시작해요. 되돌릴 수 없어요."
        onClose={() => setConfirmReset(false)}
        initialFocusRef={cancelRef}
        actions={
          <>
            <Button
              variant="danger"
              icon="trash"
              onClick={() => {
                update((d) => ({ ...d, progress: { stars: {}, best: 0 } }));
                setConfirmReset(false);
                toast.show("진행도를 초기화했어요.", "success");
              }}
            >
              초기화
            </Button>
            <Button ref={cancelRef} onClick={() => setConfirmReset(false)}>
              취소
            </Button>
          </>
        }
      />
    </ScreenLayout>
  );
}
