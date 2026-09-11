// 표현만. 규칙은 game.js, 데이터는 data/*.json 이 가진다.
import { shuffle, sizesFor, startBracket, pick, champion, roundName, hopPath, hopDelay } from "./game.js";

const $ = (s) => document.querySelector(s);
const h = (tag, props = {}, ...kids) => {
  const el = Object.assign(document.createElement(tag), props);
  el.append(...kids);
  return el;
};
const getJSON = (p) => fetch(p).then((r) => (r.ok ? r.json() : null), () => null);

const [cfg, data] = await Promise.all([getJSON("data/menus.json"), getJSON("data/restaurants.json")]);

const shops = data?.restaurants ?? {};
const hasData = Object.keys(shops).length > 0;
const placesOf = (menu) => (data?.menus[menu] ?? []).map((id) => shops[id]);
// 수집 데이터가 있으면 근처에 식당이 있는 메뉴만 게임에 올린다
const categories = Object.fromEntries(
  Object.entries(cfg.categories)
    .map(([c, ms]) => [c, hasData ? ms.filter((m) => placesOf(m).length) : ms])
    .filter(([, ms]) => ms.length),
);
const categoryOf = Object.fromEntries(Object.entries(categories).flatMap(([c, ms]) => ms.map((m) => [m, c])));
const all = Object.keys(categoryOf);
let category = "전체";
const pool = () => (category === "전체" ? all : categories[category]);
const shopPool = () => [...new Set(pool().flatMap(placesOf))];

$("#status").textContent = hasData
  ? `${cfg.center.name} 반경 ${cfg.radius}m · 식당 ${Object.keys(shops).length}곳 · ${data.updated} 갱신`
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
          drawGrid();
          bracket = null;
          renderWorldcup();
        },
      }),
    ),
  );
}

// ---- 사진 룰렛 ----
const GRID_MAX = 12; // 한 화면에 12곳. 섞기로 다른 식당을 올린다
const grid = $("#grid");
let onGrid = [];
let at = 0;
let spinning = false;

const photo = (shop, className) =>
  shop.photo ? h("img", { className, src: shop.photo, alt: "", onerror: (e) => e.target.remove() }) : "";

function drawGrid() {
  if (spinning) return;
  const all = shopPool();
  onGrid = shuffle(all).slice(0, GRID_MAX);
  at = 0;
  grid.replaceChildren(...onGrid.map((s) => h("figure", { className: "tile" }, photo(s), h("figcaption", { textContent: s.name }))));
  $("#roulette-hint").textContent = onGrid.length
    ? `근처 식당 ${all.length}곳 중 ${onGrid.length}곳에서 골라요`
    : "식당 데이터가 아직 없어요";
  $("#spin").disabled = !onGrid.length;
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

$("#spin").onclick = async () => {
  if (spinning || !onGrid.length) return;
  spinning = true;
  $("#spin").disabled = true;
  grid.classList.add("spinning");
  const k = Math.floor(Math.random() * onGrid.length);
  const path = matchMedia("(prefers-reduced-motion: reduce)").matches ? [k] : hopPath(onGrid.length, at, k);
  for (const [i, idx] of path.entries()) {
    [...grid.children].forEach((t, j) => t.classList.toggle("on", j === idx));
    await wait(hopDelay(i, path.length));
  }
  at = k;
  spinning = false;
  $("#spin").disabled = false;
  const shop = onGrid[k];
  showResult("🎯 룰렛이 골랐어요", shop.name, [shop]);
};
$("#reshuffle").onclick = () => {
  grid.classList.remove("spinning");
  drawGrid();
};

// ---- 월드컵 ----
let bracket = null;

const card = (menu) =>
  h("button", { className: "card", onclick: () => { bracket = pick(bracket, menu); renderWorldcup(); } },
    h("strong", { textContent: menu }),
    h("small", { textContent: [categoryOf[menu], placesOf(menu).length && `근처 ${placesOf(menu).length}곳`].filter(Boolean).join(" · ") }),
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
    showResult("🏆 메뉴 월드컵 우승", win, placesOf(win));
    return;
  }
  const { round, i } = bracket;
  box.replaceChildren(
    h("p", { className: "hint", textContent: `${roundName(round.length)} ${i / 2 + 1} / ${round.length / 2}` }),
    h("div", { className: "match" }, card(round[i]), h("span", { className: "vs", textContent: "VS" }), card(round[i + 1])),
  );
}

// ---- 결과: 식당 목록 + 지도 ----
function showResult(label, title, list) {
  $("#result").hidden = false;
  $("#result-label").textContent = label;
  $("#result-title").textContent = title;
  $("#places").replaceChildren(
    ...(list.length
      ? list.map((r, idx) =>
          h("li", {},
            photo(r, "thumb"),
            h("button", { className: "place", onclick: () => focusMarker(idx) },
              h("strong", { textContent: r.name }),
              h("span", { textContent: `${r.category} · ${r.distance}m` }),
            ),
            h("div", { className: "links" },
              h("a", { href: r.url, target: "_blank", rel: "noopener", textContent: "카카오맵 ↗" }),
              r.photoSource ? h("a", { className: "source", href: r.photoSource, target: "_blank", rel: "noopener noreferrer", textContent: "사진 출처" }) : "",
            ),
          ))
      : [h("li", { textContent: hasData ? "반경 안 식당이 없어요" : "식당 데이터가 아직 없어요" })]),
  );
  drawMap(list);
  $("#result").scrollIntoView({ behavior: "smooth", block: "start" });
}

// 지도: Leaflet + OpenStreetMap 타일. API 키가 필요 없다
let map = null;
let layer = null;
let markers = [];

function drawMap(list) {
  if (!window.L) return; // CDN이 막히면 목록만 보여준다
  $("#map").hidden = false;
  const home = [cfg.center.lat, cfg.center.lng];
  if (!map) {
    map = L.map("map").setView(home, 16);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap" }).addTo(map);
    L.circle(home, { radius: cfg.radius, weight: 1, fillOpacity: 0.04 }).addTo(map);
    L.marker(home, { title: cfg.center.name, icon: L.divIcon({ html: "🏢", className: "me", iconSize: [28, 28] }) }).addTo(map);
  }
  layer?.remove();
  markers = list.map((r) => L.marker([r.lat, r.lng], { title: r.name }).bindPopup(h("strong", { textContent: r.name })));
  layer = L.layerGroup(markers).addTo(map);
  if (list.length) map.fitBounds([home, ...list.map((r) => [r.lat, r.lng])], { padding: [30, 30] });
  else map.setView(home, 16);
}

function focusMarker(idx) {
  if (!map || !markers[idx]) return;
  map.setView(markers[idx].getLatLng(), 18);
  markers[idx].openPopup();
}

renderChips();
drawGrid();
renderWorldcup();
