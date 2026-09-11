import assert from "node:assert/strict";
import { sizesFor, startBracket, pick, champion, roundName, sliceAt, spinTo } from "../site/game.js";

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

for (const n of [2, 7, 12]) {
  let rot = 0;
  for (let k = 0; k < n; k++) {
    for (const jitter of [-0.49, 0, 0.49]) {
      const next = spinTo(rot, k, n, { jitter });
      assert.ok(next - rot >= 5 * 360, "최소 5바퀴");
      assert.equal(sliceAt(next, n), k, `n=${n} k=${k} jitter=${jitter}`);
      rot = next;
    }
  }
}
console.log("ok");
