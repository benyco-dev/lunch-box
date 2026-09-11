// 표현만. 규칙은 game.js, 데이터는 data/*.json 이 가진다.
import { shuffle, sizesFor, startBracket, pick, champion, roundName, sliceAt, spinTo } from "./game.js";

const $ = (s) => document.querySelector(s);
const h = (tag, props = {}, ...kids) => {
  const el = Object.assign(document.createElement(tag), props);
  el.append(...kids);
  return el;
};
const getJSON = (p) => fetch(p).then((r) => (r.ok ? r.json() : null), () => null);

const [cfg, data, conf] = await Promise.all([
  getJSON("data/menus.json"),
  getJSON("data/restaurants.json"),
  import("./config.js").then((m) => m.default, () => ({})), // CI가 생성. 로컬엔 없어도 지도만 빠진다
]);

const places = data?.menus ?? {};
const hasData = Object.keys(places).length > 0;
// 수집 데이터가 있으면 근처에 식당이 있는 메뉴만 게임에 올린다
const categories = Object.fromEntries(
  Object.entries(cfg.categories)
    .map(([c, ms]) => [c, hasData ? ms.filter((m) => places[m]?.length) : ms])
    .filter(([, ms]) => ms.length),
);
const categoryOf = Object.fromEntries(Object.entries(categories).flatMap(([c, ms]) => ms.map((m) => [m, c])));
const all = Object.keys(categoryOf);
let category = "전체";
const pool = () => (category === "전체" ? all : categories[category]);

const shopCount = new Set(Object.values(places).flat().map((r) => r.name + r.address)).size;
$("#status").textContent = hasData
  ? `${cfg.center.name} 반경 ${cfg.radius}m · 식당 ${shopCount}곳 · ${data.updated} 갱신`
  : `${cfg.center.name} 반경 ${cfg.radius}m · 식당 데이터 수집 전`;

// ---- 탭 · 종목 ----
document.querySelectorAll("[data-tab]").forEach((tab) => {
  tab.onclick = () => {
    document.querySelectorAll("[data-tab]").forEach((t) => {
      t.ariaSelected = String(t === tab);
      $(`#${t.dataset.tab}`).hidden = t !== tab;
    });
  };
});

function renderChips() {
  $("#chips").replaceChildren(
    ...["전체", ...Object.keys(categories)].map((c) =>
      h("button", {
        className: "chip",
        ariaPressed: String(c === category),
        textContent: `${c} ${c === "전체" ? all.length : categories[c].length}`,
        onclick: () => {
          category = c;
          renderChips();
          drawWheel();
          bracket = null;
          renderWorldcup();
        },
      }),
    ),
  );
}

// ---- 룰렛 ----
const wheel = $("#wheel");
const WHEEL_MAX = 12; // 조각이 더 많으면 글자가 안 읽힌다. 섞기로 다른 12개를 올린다
let slices = [];
let rotation = 0;
let spinning = false;

function drawWheel() {
  if (spinning) return;
  slices = shuffle(pool()).slice(0, WHEEL_MAX);
  const ctx = wheel.getContext("2d");
  const n = slices.length, r = wheel.width / 2;
  ctx.clearRect(0, 0, wheel.width, wheel.height);
  slices.forEach((menu, k) => {
    const a0 = (k / n) * 2 * Math.PI - Math.PI / 2; // 12시부터 시계방향 — game.js 규약
    const a1 = ((k + 1) / n) * 2 * Math.PI - Math.PI / 2;
    ctx.beginPath();
    ctx.moveTo(r, r);
    ctx.arc(r, r, r - 4, a0, a1);
    ctx.closePath();
    ctx.fillStyle = `hsl(${(k * 360) / n} 80% 72%)`;
    ctx.fill();
    ctx.save();
    ctx.translate(r, r);
    ctx.rotate((a0 + a1) / 2);
    ctx.fillStyle = "#2b2521";
    ctx.font = `600 ${n > 8 ? 30 : 36}px system-ui, sans-serif`;
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillText(menu, r - 28, 0);
    ctx.restore();
  });
}

const landed = () => {
  spinning = false;
  $("#spin").disabled = false;
  showResult(slices[sliceAt(rotation, slices.length)], "🎯 룰렛이 골랐어요");
};

$("#spin").onclick = () => {
  if (spinning || !slices.length) return;
  spinning = true;
  $("#spin").disabled = true;
  const k = Math.floor(Math.random() * slices.length);
  rotation = spinTo(rotation, k, slices.length, { jitter: Math.random() - 0.5 });
  wheel.style.transform = `rotate(${rotation}deg)`;
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) landed(); // transition 없으면 transitionend도 없다
};
wheel.addEventListener("transitionend", landed);
$("#reshuffle").onclick = drawWheel;

// ---- 월드컵 ----
let bracket = null;

const card = (menu) =>
  h("button", { className: "card", onclick: () => { bracket = pick(bracket, menu); renderWorldcup(); } },
    h("strong", { textContent: menu }),
    h("small", { textContent: [categoryOf[menu], places[menu] && `근처 ${places[menu].length}곳`].filter(Boolean).join(" · ") }),
  );

function renderWorldcup() {
  const box = $("#wc");
  if (!bracket) {
    const n = pool().length, sizes = sizesFor(n);
    box.replaceChildren(
      h("p", { className: "hint", textContent: sizes.length ? "몇 강으로 할까요?" : `메뉴가 ${n}개뿐이라 8강을 못 만들어요. 전체나 룰렛으로 골라보세요.` }),
      h("div", { className: "sizes" },
        ...sizes.map((s) => h("button", { className: "btn", textContent: `${s}강`, onclick: () => { bracket = startBracket(pool(), s); renderWorldcup(); } })),
      ),
    );
    return;
  }
  const win = champion(bracket);
  if (win) {
    bracket = null;
    renderWorldcup();
    showResult(win, "🏆 메뉴 월드컵 우승");
    return;
  }
  const { round, i } = bracket;
  box.replaceChildren(
    h("p", { className: "hint", textContent: `${roundName(round.length)} ${i / 2 + 1} / ${round.length / 2}` }),
    h("div", { className: "match" }, card(round[i]), h("span", { className: "vs", textContent: "VS" }), card(round[i + 1])),
  );
}

// ---- 결과: 식당 목록 + 지도 ----
const naverLink = (r) =>
  `https://map.naver.com/p/search/${encodeURIComponent(`${r.address.split(" ").slice(0, 2).join(" ")} ${r.name}`)}`;

function showResult(menu, label) {
  const list = places[menu] ?? [];
  $("#result").hidden = false;
  $("#result-label").textContent = label;
  $("#result-title").textContent = menu;
  $("#places").replaceChildren(
    ...(list.length
      ? list.map((r, idx) =>
          h("li", {},
            h("button", { className: "place", onclick: () => focusMarker(idx) },
              h("strong", { textContent: r.name }),
              h("span", { textContent: `${r.category} · ${r.distance}m` }),
            ),
            h("a", { href: naverLink(r), target: "_blank", rel: "noopener", textContent: "네이버지도 ↗" }),
          ))
      : [h("li", { textContent: hasData ? "반경 안 식당이 없어요" : "식당 데이터가 아직 없어요" })]),
  );
  drawMap(list);
  $("#result").scrollIntoView({ behavior: "smooth", block: "start" });
}

let mapsLoaded = null;
const loadMaps = () =>
  (mapsLoaded ??= !conf.naverMapKeyId
    ? Promise.resolve(false)
    : new Promise((ok) =>
        document.head.append(h("script", {
          src: `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${encodeURIComponent(conf.naverMapKeyId)}`,
          onload: () => ok(true),
          onerror: () => ok(false),
        })),
      ));

let map = null;
let markers = [];

async function drawMap(list) {
  const el = $("#map");
  if (!(await loadMaps())) return;
  el.hidden = false;
  const { maps } = window.naver;
  const home = new maps.LatLng(cfg.center.lat, cfg.center.lng);
  if (!map) {
    map = new maps.Map(el, { center: home, zoom: 16 });
    new maps.Marker({ map, position: home, title: cfg.center.name, icon: { content: '<div class="me">🏢</div>', anchor: new maps.Point(12, 12) } });
  }
  markers.forEach((m) => m.setMap(null));
  markers = list.map((r) => new maps.Marker({ map, position: new maps.LatLng(r.lat, r.lng), title: r.name }));
  const bounds = new maps.LatLngBounds(home, home);
  markers.forEach((m) => bounds.extend(m.getPosition()));
  if (markers.length) map.fitBounds(bounds, { top: 40, right: 40, bottom: 40, left: 40 });
  else map.setCenter(home);
}

function focusMarker(idx) {
  if (!map || !markers[idx]) return;
  map.setZoom(18);
  map.panTo(markers[idx].getPosition());
}

renderChips();
drawWheel();
renderWorldcup();
