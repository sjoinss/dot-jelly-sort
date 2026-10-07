@AGENTS.md

# 도트 젤리 소팅 — 작업 안내

뿌요뿌요식 도트 젤리로 하는 워터 소트 퍼즐 (Next.js 정적 내보내기 + Canvas 2D, PWA). 기획서: `dot-jelly-sort-spec.md`.
분위기·UI 컴포넌트·PC 프레임·스킨 불러오기·도트 에디터 조작은 `../jumping`(점프점프)에서 가져와 맞췄다.

## 명령

| 명령 | 내용 |
|---|---|
| `npm run dev` | 개발 서버 |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | `tsconfig.test.json`으로 `.test-build/`에 컴파일 후 `node --test` (DOM 없는 로직만) |
| `npm run levels` | 스테이지 1~3000(`-- N`으로 바꿈)을 풀이기 + 실제 규칙으로 끝까지 풀어 봄 (약 30초) |
| `npm run build` | `out/` 정적 내보내기 |
| `npm run icons` | `public/icons/*.png` 다시 만들기 (기본 젤리 두 개가 이어진 모습) |

- 이 PC(Windows)의 `python`은 MS Store 스텁 → 스크립트는 **node**로. 긴 수정 스크립트는 scratchpad에 `.cjs`로.

## 구조

```
src/
  config/stage.ts   스테이지 상수 (유한 50, 종류 수 증가, 가림 번호·확률 10%→20%, 별 기준)
  game/             rules(이동·되돌리기 3회·가림 공개·막힘), levels(시드 생성 + 풀이기), rng
  sprites/          jelly(16×14 마스크·자동 외곽선·연결 변형·프리셋·팔레트), block(마크 8×8 얼굴·만든 얼굴·스킨→얼굴), defaultSkins(기본 스킨 9종 데이터)
  render/           spriteBank(종류×변형 캐시), layout(정수 배율 병 배치), board(판 그리기·모션)
  editor/           젤리 에디터 (JellyCanvas, jellyEdit 순수 함수, 점프점프의 ColorPicker·history)
  skins/            마크 스킨 화면 (skinFetch = 점프점프 것, skinImage = PNG → 얼굴)
  lib/              save(스키마 v1·검증·JSON 파일), progress, fileIO
  components/       App(화면 전환), DesktopFrame, SaveProvider(localStorage), screens/, ui/(점프점프 그대로)
  styles/tokens.css 점프점프 기본 토큰 + 마크 모드용 [data-theme="blocks"]
```

## 핵심 규칙 / 결정

- **해결 가능 보장**: 기획서의 "역방향 셔플"은 "가득 찬 병 + 빈 병 2개" 시작 모양에 거의 닿지 못해서(시뮬레이션 100번 중 0~17번) **시드로 섞기 → 풀이기(solve)로 풀이 확인**한 판만 쓴다. 풀이 길이가 별 기준(par). `tests/levels.test.ts`가 1~400번, `npm run levels`가 1~3000번을 실제 규칙으로 풀어 본다(실패·대체 판 0).
- **연결 표현**: 젤리는 맞닿는 면을 목 폭(12칸)까지 넓히고 그 면 외곽선을 없앤다. 블록은 위·아래 외곽선 줄을 얼굴 끝 줄 색으로 채워 기둥처럼. "?" 블록은 연결하지 않는다.
- **그리기**: 모든 도트는 기기 픽셀 기준 정수 배율, `imageSmoothingEnabled = false`. 병마다 투명 `<button>`을 위에 얹어 클릭·키보드·스크린리더를 처리.
- **마크 모드**: 얼굴 편집 없음. 기본 스킨 9종(스티브…주리) → 넘치면 `generatedFace(typeId)`(조합 번호로 겹치지 않음). 닉네임 불러오기는 점프점프와 같은 클라이언트 요청(minotar → mc-heads) — 정적 배포라 서버 프록시(Route Handler)는 없다. UI 색은 블록 월드 테마 토큰.
- **저장**: localStorage `dot-jelly-sort.save` (version 1). 읽을 때 `readSave`가 전부 검증(모르는 값은 기본값, 마스크 밖 도트는 버림). 구조를 바꾸면 `SAVE_VERSION`을 올리고 `readSave`에서 변환.
- **여분 칸 (사용자 결정 2026-10-07, 기획서의 "병 추가 없음"을 바꿈)**: 판 아래 「여분 병 받기 / 여분 칸 늘리기 (n/4)」 — 한 판 최대 4번(`STAGE.SPARE_MAX`). 처음엔 1칸짜리 여분 병, 그다음부터 그 병이 1칸씩 커져 최대 4칸 병 하나. 이동으로 세지 않고 별 감점 없음. 되돌려도 남고 다시하기하면 사라짐. 병마다 용량은 `GameState.capacities`, 받은 칸은 `GameState.spare`(여분 병 = 마지막 병). 키가 작은 여분 병은 같은 줄 병과 바닥을 맞춤. 4칸 미만 여분 병에 블록이 남으면 클리어가 아님.
- **가림 공개**: 맨 위와 같은 종류로 이어진 덩어리 전체를 보여 준다(사용자 결정).
- 진행도는 모드와 무관하게 하나. 무한 모드는 50번을 깨야 열린다.

## 확인 요령 (Claude in Chrome)

- 휴대폰 크기 확인: `/__audit` 같은 404 주소에서 body를 비우고 같은 출처 iframe(390×844, scale .6)으로 `/`를 띄워 `contentDocument`로 조작.
- 스테이지를 건너뛰려면 localStorage `dot-jelly-sort.save`의 `progress.best`를 바꾸고 새로고침. 확인 뒤 되돌린다.
- 클리어 확인: node로 `.test-build/src/game/levels.js`의 `solve(generateLevel(n).bottles, 4)`를 구해 병 버튼을 순서대로 누른다.
