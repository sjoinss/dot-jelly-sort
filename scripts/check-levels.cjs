/**
 * 스테이지 1~N이 모두 깰 수 있는지 넓게 확인 (기본 3000). npm test가 1~400을 보고, 이것은 더 넓게.
 * 실행: npm run levels  또는  npm run levels -- 5000
 * 풀이기가 찾은 순서를 실제 게임 규칙(applyMove)으로 옮겨 클리어되는지까지 본다.
 */
const L = require("../.test-build/src/game/levels.js");
const R = require("../.test-build/src/game/rules.js");

const N = Number(process.argv[2]) || 3000;
const failed = [];
const fallback = [];
let worst = { ms: 0, stage: 0 };
const t0 = Date.now();
for (let s = 1; s <= N; s++) {
  const a = Date.now();
  const lv = L.generateLevel(s);
  const ms = Date.now() - a;
  if (ms > worst.ms) worst = { ms, stage: s };
  if (lv.fallback) fallback.push(s);
  const plan = L.solve(lv.bottles, lv.capacity);
  let g = R.createGame(lv.bottles, lv.capacity, lv.hidden);
  for (const [f, t] of plan ?? []) g = R.applyMove(g, f, t)?.state ?? g;
  if (!plan || !R.isSolved(g)) failed.push(s);
}
console.log(`스테이지 1~${N}: 실패 ${failed.length}개, 대체 판 ${fallback.length}개, ${((Date.now() - t0) / 1000).toFixed(1)}초 (가장 느린 생성 ${worst.ms}ms @ ${worst.stage})`);
if (failed.length) console.log("실패:", failed.slice(0, 20).join(", "));
if (fallback.length) console.log("대체 판:", fallback.slice(0, 20).join(", "));
process.exit(failed.length || fallback.length ? 1 : 0);
