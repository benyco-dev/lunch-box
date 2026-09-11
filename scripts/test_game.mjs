import assert from "node:assert/strict";
import { sizesFor, startBracket, pick, champion, roundName, hopPath, hopDelay } from "../site/game.js";

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

for (const n of [1, 2, 7, 12]) {
  for (let start = 0; start < n; start++) {
    for (let k = 0; k < n; k++) {
      const path = hopPath(n, start, k);
      assert.equal(path[0], start);
      assert.equal(path.at(-1), k, `n=${n} start=${start} k=${k}`);
      assert.ok(path.length - 1 >= 24, "최소 24칸");
      path.slice(1).forEach((p, i) => assert.equal(p, (path[i] + 1) % n, "한 칸씩 이동"));
    }
  }
}
assert.ok(hopDelay(0, 30) < hopDelay(29, 30), "끝으로 갈수록 느려짐");
console.log("ok");
