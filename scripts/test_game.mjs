import assert from "node:assert/strict";
import { sizesFor, startBracket, pick, champion, roundName, reelStrip, resizePicks, fillEmpty, rerollPick } from "../site/game.js";

const menus = Array.from({ length: 20 }, (_, i) => `메뉴${i}`);

assert.deepEqual(sizesFor(7), []);
assert.deepEqual(sizesFor(20), [8, 16]);
assert.deepEqual(sizesFor(40), [8, 16, 32]);

for (const size of [8, 16]) {
  let b = startBracket(menus, size);
  assert.equal(new Set(b.round).size, size);
  let clicks = 0;
  const rounds = [];
  while (!champion(b)) {
    if (b.i === 0) rounds.push(roundName(b.round.length));
    b = pick(b, b.round[b.i + 1]); // 항상 오른쪽 선택
    clicks++;
  }
  assert.equal(clicks, size - 1);
  assert.equal(rounds.at(-1), "결승");
  assert.ok(menus.includes(champion(b)));
}

for (const pool of [["a"], ["a", "b", "c"], menus]) {
  const winner = pool.at(-1);
  const { target, items } = reelStrip(pool, winner);
  assert.equal(items.length, 60);
  assert.equal(target, 53);
  assert.equal(items[target], winner);
  assert.ok(items.every((x) => pool.includes(x)), "릴 칸은 전부 풀 안의 식당");
}
// 함께 고르기
assert.deepEqual(resizePicks(["a", null, "c"], 5), ["a", null, "c", null, null], "늘리면 뒤에 빈 칸");
assert.deepEqual(resizePicks(["a", "b", "c"], 2), ["a", "b"], "줄이면 뒷사람부터 빠짐");
assert.deepEqual(fillEmpty(["a", null, "c", null], ["x", "y"], () => 0.99), ["a", "y", "c", "x"], "빈 칸만, 겹치지 않게 채움");
const shops = Array.from({ length: 10 }, (_, i) => `s${i}`);
for (let t = 0; t < 200; t++) {
  const f = fillEmpty(Array(10).fill(null), shops);
  assert.equal(new Set(f).size, 10, "식당 수만큼 인원이면 전부 달라야 함");
  const r = rerollPick(f.slice(0, 5), 2, shops);
  assert.equal(new Set(r).size, 5, "다시 뽑아도 겹치지 않음");
  assert.notEqual(r[2], f[2], "다시 뽑으면 자기 것과도 다름");
}
assert.deepEqual(fillEmpty([null, null], ["x"], () => 0), ["x", "x"], "풀이 바닥나면 그때만 겹침");
console.log("ok");
