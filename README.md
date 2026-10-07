# 도트 젤리 소팅

같은 젤리끼리 한 병에 모으는 워터 소트 퍼즐입니다. 같은 종류가 맞닿으면 뿌요뿌요처럼 하나로 이어지고,
젤리의 몸통 색과 눈·입·무늬를 직접 도트로 찍을 수 있어요. 마크 모드에서는 네모난 머리 블록으로 플레이하고 스킨을 불러와 쓸 수 있습니다.

- 기획: [`dot-jelly-sort-spec.md`](dot-jelly-sort-spec.md)

## 개발

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # 단위 테스트 (node:test)
npm run build      # 정적 파일을 out/ 에 생성
```

Next.js(App Router, 정적 내보내기) + TypeScript, 외부 라이브러리 없이 Canvas 2D. 데이터는 브라우저 localStorage에만 저장합니다.
마크 닉네임으로 스킨을 불러올 때만 닉네임을 minotar.net(실패 시 mc-heads.net)으로 보냅니다.

## 배포

`main` 브랜치에 푸시하면 GitHub Actions(`.github/workflows/deploy.yml`)가 테스트 → 빌드 → GitHub Pages 배포를 합니다.
