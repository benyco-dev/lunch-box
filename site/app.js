// 표현만. 규칙은 game.js, 데이터는 data/*.json 이 가진다.
import { shuffle, sizesFor, startBracket, pick, champion, roundName, reelStrip } from "./game.js";

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

const updated = hasData && new Date(data.updated).toLocaleDateString("ko-KR", { month: "long", day: "numeric" });
$("#status").textContent = `${cfg.center.name} 반경 ${cfg.radius}m\n` +
  (hasData ? `식당 ${Object.keys(shops).length}곳, ${updated} 갱신` : "식당 데이터 수집 전");

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
        textContent: c, // 숫자는 탭마다 단위가 달라(식당 곳 / 메뉴 개) 각 탭 안내 문구에서 보여준다
        onclick: () => {
          category = c;
          renderChips();
          drawReel();
          bracket = null;
          renderWorldcup();
        },
      }),
    ),
  );
}

// ---- 사진 릴: 종목의 식당 전체에서 균등하게 하나를 먼저 뽑고, 릴은 거기에 멈추는 연출만 한다 ----
const reel = $("#reel");
const strip = $("#strip");
let spinning = false;
let winner = null;
let target = -1;

// 사진 자리. 사진이 없거나 깨지면 뒤에 깔린 포크·나이프 아이콘이 보인다
const pic = (shop, className = "") =>
  h("div", { className: `pic ${className}` },
    h("i", { className: "ph ph-fork-knife", ariaHidden: "true" }),
    shop?.photo ? h("img", { src: shop.photo, alt: "", onerror: (e) => e.target.remove() }) : "",
  );
const tile = (s) => h("figure", { className: "tile" }, pic(s), h("figcaption", { textContent: s.name }));

function drawReel() {
  if (spinning) return;
  const all = shopPool();
  strip.classList.remove("moving", "done");
  strip.style.transform = "";
  strip.replaceChildren(...shuffle(all).slice(0, 12).map(tile));
  $("#roulette-hint").textContent = all.length ? `근처 식당 ${all.length}곳 전체에서 뽑아요` : "식당 데이터가 아직 없어요";
  $("#spin").disabled = !all.length;
}

$("#spin").onclick = () => {
  const all = shopPool();
  if (spinning || !all.length) return;
  spinning = true;
  $("#spin").disabled = true;
  winner = all[Math.floor(Math.random() * all.length)];
  const r = reelStrip(all, winner);
  target = r.target;

  strip.classList.remove("moving", "done");
  strip.style.transform = "translateX(0)";
  strip.replaceChildren(...r.items.map(tile));
  const t = strip.children[target];
  const jitter = (Math.random() - 0.5) * t.offsetWidth * 0.6; // 칸 가운데서 살짝 비껴 멈춰야 진짜 같다
  const x = t.offsetLeft + t.offsetWidth / 2 - reel.clientWidth / 2 + jitter; // offsetLeft 읽기가 리플로를 강제해 transition이 처음부터 돈다
  strip.classList.add("moving");
  strip.style.transform = `translateX(${-x}px)`;
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) landed();
};

function landed() {
  spinning = false;
  $("#spin").disabled = false;
  strip.children[target]?.classList.add("on");
  strip.classList.add("done");
  showResult("ph-dice-five", "룰렛이 골랐어요", winner.name, [winner]);
}
strip.addEventListener("transitionend", (e) => e.target === strip && e.propertyName === "transform" && landed());

// ---- 월드컵 ----
let bracket = null;

const card = (menu) =>
  h("button", { className: "card", onclick: () => { bracket = pick(bracket, menu); renderWorldcup(); } },
    pic(placesOf(menu).find((s) => s.photo)),
    h("strong", { textContent: menu }),
    h("small", { textContent: [categoryOf[menu], placesOf(menu).length && `근처 ${placesOf(menu).length}곳`].filter(Boolean).join(" · ") }),
  );

function renderWorldcup() {
  const box = $("#wc");
  if (!bracket) {
    const n = pool().length, sizes = sizesFor(n);
    box.replaceChildren(
      sizes.length
        ? h("p", { className: "hint", textContent: `메뉴 ${n}개로 몇 강을 할까요?` })
        : h("p", { className: "hint warn", textContent: `메뉴가 ${n}개뿐이라 8강을 못 만들어요. 전체나 룰렛으로 골라보세요.` }),
      h("div", { className: "sizes" },
        ...sizes.map((s) =>
          h("button", { className: "size", onclick: () => { bracket = startBracket(pool(), s); renderWorldcup(); } },
            h("strong", { textContent: `${s}강` }),
            h("span", { textContent: `${s - 1}번 고르기` }),
          )),
      ),
    );
    return;
  }
  const win = champion(bracket);
  if (win) {
    bracket = null;
    renderWorldcup();
    showResult("ph-trophy", "메뉴 월드컵 우승", win, placesOf(win));
    return;
  }
  const { round, i } = bracket;
  box.replaceChildren(
    h("div", { className: "round" },
      h("strong", { textContent: roundName(round.length) }),
      h("span", { textContent: `${i / 2 + 1} / ${round.length / 2}` }),
    ),
    h("div", { className: "match" }, card(round[i]), h("span", { className: "vs", textContent: "VS" }), card(round[i + 1])),
  );
}

// ---- 결과: 식당 목록 + 지도 ----
function showResult(icon, label, title, list) {
  $("#result-empty").hidden = true;
  const body = $("#result-body");
  body.hidden = false;
  body.classList.remove("enter");
  void body.offsetWidth; // 리플로를 한 번 일으켜야 같은 애니메이션이 다시 재생된다
  body.classList.add("enter");
  $("#result-label").replaceChildren(h("i", { className: `ph-fill ${icon}` }), label);
  $("#result-title").textContent = title;
  $("#places").replaceChildren(
    ...(list.length
      ? list.map((r, idx) =>
          h("li", {},
            pic(r, "thumb"),
            h("button", { className: "place", onclick: () => focusMarker(idx) },
              h("strong", { textContent: r.name }),
              h("span", { textContent: `${r.category} · ${r.distance}m` }),
            ),
            h("div", { className: "links" },
              h("a", { className: "go", href: r.url, target: "_blank", rel: "noopener" }, "카카오맵", h("i", { className: "ph ph-arrow-up-right" })),
              r.photoSource ? h("a", { className: "source", href: r.photoSource, target: "_blank", rel: "noopener noreferrer", textContent: "사진 출처" }) : "",
            ),
          ))
      : [h("li", { className: "none", textContent: hasData ? "반경 안 식당이 없어요" : "식당 데이터가 아직 없어요" })]),
  );
  drawMap(list);
  if (!matchMedia("(min-width: 960px)").matches) $("#result").scrollIntoView({ behavior: "smooth", block: "start" }); // 넓은 화면은 결과가 옆에 고정돼 있다
}

// 지도: Leaflet + OpenStreetMap 타일. API 키가 필요 없다
let map = null;
let layer = null;
let markers = [];

function drawMap(list) {
  if (!window.L) return; // CDN이 막히면 목록만 보여준다
  $("#map").hidden = false;
  const home = [cfg.center.lat, cfg.center.lng];
  const icon = (name, className, size, anchor) =>
    L.divIcon({ html: `<i class="ph-fill ${name}"></i>`, className, iconSize: [size, size], iconAnchor: anchor, popupAnchor: [0, -24] });
  if (!map) {
    const accent = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim();
    map = L.map("map").setView(home, 16);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap" }).addTo(map);
    L.circle(home, { radius: cfg.radius, color: accent, weight: 1.5, fillOpacity: 0.06 }).addTo(map);
    L.marker(home, { title: cfg.center.name, icon: icon("ph-buildings", "me", 34) }).addTo(map);
  }
  layer?.remove();
  markers = list.map((r) =>
    L.marker([r.lat, r.lng], { title: r.name, icon: icon("ph-map-pin", "pin", 34, [17, 32]) }).bindPopup(h("strong", { textContent: r.name })));
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
drawReel();
renderWorldcup();
