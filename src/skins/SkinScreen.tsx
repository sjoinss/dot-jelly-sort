"use client";

import { useId, useRef, useState } from "react";
import { ScreenLayout } from "@/components/screens/ScreenLayout";
import { useSave } from "@/components/SaveProvider";
import { SpriteStack, useBank } from "@/components/SpriteStack";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { InlineMessage } from "@/components/ui/InlineMessage";
import { useToast } from "@/components/ui/Toast";
import { STAGE } from "@/config/stage";
import type { SpriteDef } from "@/lib/save";
import { defaultFace, FACE } from "@/sprites/block";
import { fetchSkinByName, isValidMcName } from "./skinFetch";
import { faceFromFile } from "./skinImage";
import styles from "./SkinScreen.module.css";

type Props = { onBack: () => void };

const TYPE_COUNT = STAGE.INFINITE_TYPES_MAX;

type Status = { kind: "idle" } | { kind: "loading"; what: "name" | "file" } | { kind: "error"; message: string; canRetry: boolean };

/**
 * 마크 모드 스킨 불러오기 (기획서 8번). 얼굴 도트 편집은 없다.
 * 종류마다 기본 스킨(스티브·알렉스…, 넘치면 만든 얼굴)이 자동으로 들어가 있고,
 * 닉네임 또는 스킨 PNG로 그 종류의 얼굴을 바꾼다.
 */
export function SkinScreen({ onBack }: Props) {
  const { save, update } = useSave();
  const toast = useToast();
  const bank = useBank({ mode: "block" });
  const [editing, setEditing] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [nameError, setNameError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const helpId = useId();
  const errId = useId();

  const open = (t: number) => {
    setEditing(t);
    setName("");
    setNameError(null);
    setStatus({ kind: "idle" });
  };
  const close = () => {
    if (status.kind === "loading") return;
    setEditing(null);
  };

  const register = (typeId: number, face: string[], label: string) => {
    const sprite: SpriteDef = { mode: "block", width: FACE, height: FACE, bodyColor: "", inner: face, source: "skin", name: label.slice(0, 40) };
    update((s) => ({ ...s, block: { types: { ...s.block.types, [typeId]: sprite } } }));
    setEditing(null);
    setStatus({ kind: "idle" });
    toast.show(`${typeId + 1}번 블록을 "${label}" 스킨으로 바꿨어요.`, "success");
  };

  const loadByName = async () => {
    if (editing === null) return;
    const n = name.trim();
    if (!isValidMcName(n)) {
      setNameError("닉네임은 영문·숫자·밑줄(_)로 3~16자예요.");
      return;
    }
    setNameError(null);
    setStatus({ kind: "loading", what: "name" });
    const res = await fetchSkinByName(n);
    if (!res.ok) {
      setStatus({ kind: "error", message: res.message, canRetry: !res.message.includes("찾을 수 없어요") });
      return;
    }
    const face = await faceFromFile(res.file);
    if (!face.ok) {
      setStatus({ kind: "error", message: face.message, canRetry: true });
      return;
    }
    register(editing, face.face, n);
  };

  const loadFile = async (file: File | undefined) => {
    if (editing === null || !file) return;
    setStatus({ kind: "loading", what: "file" });
    const face = await faceFromFile(file);
    if (!face.ok) {
      setStatus({ kind: "error", message: face.message, canRetry: false });
      return;
    }
    register(editing, face.face, file.name.replace(/\.png$/i, "") || "내 스킨");
  };

  const revert = (t: number) => {
    update((s) => {
      const types = { ...s.block.types };
      delete types[t];
      return { ...s, block: { types } };
    });
    toast.show(`${t + 1}번 블록을 기본 스킨(${defaultFace(t).name})으로 되돌렸어요.`, "success");
  };

  const loading = status.kind === "loading";

  return (
    <ScreenLayout title="스킨 불러오기" onBack={onBack}>
      <div className={styles.wrap}>
        <p className={styles.intro}>
          등록하지 않은 블록은 마크 기본 스킨 얼굴이 자동으로 들어가요. 닉네임이나 스킨 파일로 원하는 블록만 바꿀 수 있어요.
        </p>
        <ul className={styles.list}>
          {Array.from({ length: TYPE_COUNT }, (_, t) => {
            const custom = save.block.types[t];
            const def = defaultFace(t);
            const label = custom ? custom.name ?? "내 스킨" : def.name;
            return (
              <li key={t} className={styles.item}>
                <SpriteStack bank={bank} types={[t]} unit={2} label={`${t + 1}번 블록 얼굴: ${label}`} />
                <div className={styles.info}>
                  <span className={styles.num}>{t + 1}번</span>
                  <span className={styles.name}>{label}</span>
                  <span className={styles.source}>{custom ? "불러온 스킨" : def.source === "default" ? "기본 스킨" : "만든 얼굴"}</span>
                </div>
                <div className={styles.itemActions}>
                  <Button icon="download" onClick={() => open(t)} aria-label={`${t + 1}번 블록 스킨 바꾸기`}>
                    바꾸기
                  </Button>
                  {custom && (
                    <Button variant="ghost" icon="reset" onClick={() => revert(t)} aria-label={`${t + 1}번 블록 기본 스킨으로`}>
                      기본
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      <Dialog open={editing !== null} title={editing !== null ? `${editing + 1}번 블록 스킨` : "스킨"} onClose={close}>
        <form
          className={styles.form}
          onSubmit={(e) => {
            e.preventDefault();
            void loadByName();
          }}
        >
          <label htmlFor={inputId} className={styles.label}>
            마크 닉네임
          </label>
          <input
            id={inputId}
            className={styles.input}
            value={name}
            maxLength={16}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            inputMode="text"
            data-autofocus
            aria-invalid={!!nameError}
            aria-describedby={nameError ? `${errId} ${helpId}` : helpId}
            onChange={(e) => {
              setName(e.target.value);
              setNameError(null);
            }}
            disabled={loading}
          />
          <p id={helpId} className={styles.help}>
            영문·숫자·밑줄(_) 3~16자. 닉네임만 스킨 서비스(minotar.net)로 보내요.
          </p>
          {nameError && (
            <p id={errId} className={styles.error}>
              {nameError}
            </p>
          )}
          <Button type="submit" variant="primary" icon="download" loading={loading && status.what === "name"} loadingLabel="불러오는 중…" disabled={loading}>
            닉네임으로 불러오기
          </Button>
        </form>

        <div className={styles.or} aria-hidden="true">
          <span>또는</span>
        </div>

        <Button icon="upload" loading={loading && status.what === "file"} loadingLabel="읽는 중…" disabled={loading} onClick={() => fileRef.current?.click()}>
          스킨 PNG 파일 올리기
        </Button>
        <p className={styles.help}>64×64 (또는 예전 64×32) 스킨 파일에서 얼굴과 모자 층을 합쳐 써요. 파일은 이 기기 밖으로 보내지 않아요.</p>
        <input
          ref={fileRef}
          type="file"
          accept="image/png,.png"
          className="visually-hidden"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(e) => {
            void loadFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />

        {status.kind === "error" && (
          <InlineMessage
            tone="error"
            title="불러오지 못했어요"
            action={
              status.canRetry ? (
                <Button icon="reset" onClick={() => void loadByName()}>
                  다시 시도
                </Button>
              ) : undefined
            }
          >
            {status.message}
          </InlineMessage>
        )}
      </Dialog>
    </ScreenLayout>
  );
}
