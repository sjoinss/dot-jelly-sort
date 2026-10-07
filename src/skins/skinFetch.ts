/**
 * 마크 닉네임으로 스킨 PNG 받아오기 (점프점프와 같은 방식 — 정적 배포라 서버 프록시 없이 브라우저에서 바로).
 * 공식 API(api.mojang.com)는 브라우저 요청(CORS)을 막아서, 스킨을 이미지로 내주는 공개 서비스를 쓴다:
 *   1) minotar.net — 없는 아이디는 404라서 "찾을 수 없어요"를 정확히 알려줄 수 있다
 *   2) mc-heads.net — minotar에 닿지 못할 때만 (없는 아이디도 기본 스킨을 주므로 첫 번째로는 안 쓴다)
 * 보내는 것은 아이디뿐이다. 받은 PNG는 파일 올리기와 같은 검사·변환(skinImage → sprites/block.ts)을 거친다.
 */

export type SkinFetchResult = { ok: true; file: File } | { ok: false; message: string };

/** 마크 닉네임 규칙: 영문·숫자·밑줄 3~16자 */
export function isValidMcName(name: string) {
  return /^[A-Za-z0-9_]{3,16}$/.test(name);
}

export const SKIN_SOURCES = [
  { host: "minotar.net", url: (name: string) => `https://minotar.net/skin/${encodeURIComponent(name)}`, notFoundIs404: true },
  { host: "mc-heads.net", url: (name: string) => `https://mc-heads.net/skin/${encodeURIComponent(name)}`, notFoundIs404: false },
] as const;

/** 스킨 PNG는 아주 작다. 이보다 크면 이상한 응답으로 본다 */
const MAX_BYTES = 256 * 1024;

export async function fetchSkinByName(rawName: string, fetchFn: typeof fetch = fetch): Promise<SkinFetchResult> {
  const name = rawName.trim();
  if (!isValidMcName(name)) return { ok: false, message: "닉네임은 영문·숫자·밑줄(_)로 3~16자예요." };
  for (const source of SKIN_SOURCES) {
    let res: Response;
    try {
      res = await fetchFn(source.url(name), { mode: "cors", credentials: "omit", referrerPolicy: "no-referrer" });
    } catch {
      continue; // 이 서비스에 닿지 못함 → 다음 서비스
    }
    if (res.status === 404 && source.notFoundIs404) return { ok: false, message: `"${name}" 닉네임을 찾을 수 없어요. 철자를 확인하거나 스킨 파일을 올려 주세요.` };
    if (!res.ok) continue;
    const blob = await res.blob();
    if (blob.size === 0 || blob.size > MAX_BYTES) continue;
    return { ok: true, file: new File([blob], `${name}.png`, { type: "image/png" }) };
  }
  return { ok: false, message: "스킨을 받아오지 못했어요. 인터넷 연결을 확인하고 다시 해 주세요. 안 되면 스킨 PNG 파일을 올려 주세요." };
}
