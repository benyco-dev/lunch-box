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

// ---- 룰렛 ----
// 조각 k는 12시 방향부터 시계방향으로 [k·s, (k+1)·s) 에 그린다. 포인터는 12시.
// 휠을 R도 돌리면 12시에 오는 조각은 sliceAt(R).
export function sliceAt(rotation, n) {
  const s = 360 / n;
  return Math.floor((((-rotation % 360) + 360) % 360) / s) % n;
}

// 현재 회전값에서 최소 turns 바퀴 더 돌아 조각 k에 멈추는 절대 회전값. jitter ∈ (-0.5, 0.5) 조각 안 위치.
export function spinTo(current, k, n, { turns = 5, jitter = 0 } = {}) {
  const s = 360 / n;
  const base = Math.ceil(current / 360) * 360 + (turns + 1) * 360; // 조각 오프셋(<360)을 빼도 turns 바퀴 보장
  return base - (k * s + s / 2 + jitter * s * 0.8);
}
