import { isSkinSize, skinToFace } from "@/sprites/block";

/**
 * 스킨 PNG 파일 → 얼굴 8×8 (브라우저에서만, 파일은 어디에도 보내지 않는다).
 * 확장자·MIME 대신 파일 앞부분(PNG 서명)으로 형식을 확인하고, 크기는 64×64 또는 예전 64×32만 받는다.
 */

export type FaceResult = { ok: true; face: string[] } | { ok: false; message: string };

const MAX_BYTES = 1024 * 1024;
const PNG_SIG = [137, 80, 78, 71, 13, 10, 26, 10];

function decode(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("decode"));
    };
    img.src = url;
  });
}

export async function faceFromFile(file: Blob): Promise<FaceResult> {
  if (file.size === 0 || file.size > MAX_BYTES) return { ok: false, message: "스킨 파일이 아니에요. 64×64 크기의 PNG 스킨 파일을 골라 주세요." };
  const head = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  if (!PNG_SIG.every((b, i) => head[i] === b)) return { ok: false, message: "PNG 파일만 쓸 수 있어요. 마크 스킨 PNG(64×64)를 골라 주세요." };
  let img: HTMLImageElement;
  try {
    img = await decode(file);
  } catch {
    return { ok: false, message: "이미지를 열 수 없어요. 파일이 손상되지 않았는지 확인해 주세요." };
  }
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  if (!isSkinSize(w, h)) return { ok: false, message: `스킨 크기가 아니에요 (${w}×${h}). 64×64 또는 64×32 PNG만 쓸 수 있어요.` };
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return { ok: false, message: "이미지를 읽지 못했어요. 다시 시도해 주세요." };
  ctx.drawImage(img, 0, 0);
  let rgba: Uint8ClampedArray;
  try {
    rgba = ctx.getImageData(0, 0, w, h).data;
  } catch {
    return { ok: false, message: "이미지를 읽지 못했어요. 파일로 내려받아 업로드해 주세요." };
  }
  const face = skinToFace({ rgba, width: w, height: h });
  return face ? { ok: true, face } : { ok: false, message: "스킨에서 얼굴을 찾지 못했어요." };
}
