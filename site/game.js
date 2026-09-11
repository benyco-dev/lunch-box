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

// ---- 사진 릴 ----
// 릴에 깔 칸 목록. 당첨은 미리 뽑아 target 칸에 두고, 나머지 칸은 흘러가는 연출용 무작위 식당이다.
// tail: 당첨 칸 뒤에도 칸을 남겨 멈췄을 때 오른쪽이 비지 않게 한다.
export function reelStrip(pool, winner, { length = 60, tail = 6, rand = Math.random } = {}) {
  const target = length - tail - 1;
  return { target, items: Array.from({ length }, (_, i) => (i === target ? winner : pool[Math.floor(rand() * pool.length)])) };
}

// ---- 함께 고르기: 사람마다 식당 하나(없으면 null). 뽑기는 고른 목록에서 하므로 여러 명이 고른 식당일수록 잘 뽑힌다 ----
// 인원이 바뀌어도 이미 고른 것은 앞사람부터 유지한다
export const resizePicks = (picks, n) => Array.from({ length: n }, (_, i) => picks[i] ?? null);

// 이미 고른 것은 빼고 무작위로 하나. 풀이 바닥나면(인원 > 식당 수) 그때만 겹친다
const pickFrom = (pool, taken, rand) => {
  const left = pool.filter((x) => !taken.includes(x));
  const from = left.length ? left : pool;
  return from[Math.floor(rand() * from.length)];
};

// 빈 칸만 서로 겹치지 않게 채운다
export function fillEmpty(picks, pool, rand = Math.random) {
  const out = [...picks];
  for (let i = 0; i < out.length; i++) if (out[i] == null) out[i] = pickFrom(pool, out, rand);
  return out;
}

// i번째 칸을 다시 뽑는다. 다른 사람 것과 지금 자기 것 모두와 다르게
export const rerollPick = (picks, i, pool, rand = Math.random) =>
  picks.map((m, j) => (j === i ? pickFrom(pool, picks, rand) : m));
