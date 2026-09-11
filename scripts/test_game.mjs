import assert from "node:assert/strict";
import { sizesFor, startBracket, pick, champion, roundName, reelStrip, resizePicks, fillEmpty } from "../site/game.js";

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
const filled = fillEmpty(["a", null, "c", null], ["x", "y"], () => 0.99);
assert.deepEqual(filled, ["a", "y", "c", "y"], "빈 칸만 채움");
console.log("ok");
