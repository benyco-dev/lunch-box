// 순수 함수만. DOM·fetch·전역 상태 없음 — 브라우저와 node 테스트에서 같은 코드가 돈다.

export function shuffle(arr, rand = Math.random) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ---- 월드컵 ----
export const sizesFor = (n) => [8, 16, 32].filter((s) => s <= n);

export const startBracket = (menus, size, rand) => ({ round: shuffle(menus, rand).slice(0, size), next: [], i: 0 });

export function pick(b, winner) {
  const next = [...b.next, winner];
  const i = b.i + 2;
  return i < b.round.length ? { ...b, next, i } : { round: next, next: [], i: 0 };
}

export const champion = (b) => (b.round.length === 1 ? b.round[0] : null);
export const roundName = (n) => (n === 2 ? "결승" : `${n}강`);

// ---- 사진 룰렛 ----
// 하이라이트가 start 칸에서 한 칸씩 이동해 k 칸에 멈추는 경로. 최소 minSteps 칸은 움직인다.
export function hopPath(n, start, k, minSteps = 24) {
  const offset = (((k - start) % n) + n) % n;
  const steps = Math.ceil(Math.max(0, minSteps - offset) / n) * n + offset;
  return Array.from({ length: steps + 1 }, (_, i) => (start + i) % n);
}

// i번째 칸에 머무는 시간(ms). 끝으로 갈수록 느려진다.
export const hopDelay = (i, total) => 40 + 380 * (i / total) ** 3;
