// 표현만. 규칙은 game.js, 데이터는 data/*.json 이 가진다.
import { shuffle, sizesFor, startBracket, pick, champion, roundName, reelStrip, resizePicks, fillEmpty, rerollPick } from "./game.js";

const $ = (s) => document.querySelector(s);
const h = (tag, props = {}, ...kids) => {
  const el = Object.assign(document.createElement(tag), props);
  el.append(...kids);
  return el;
};
const getJSON = (p) => fetch(p).then((r) => (r.ok ? r.json() : null), () => null);
// 데이터 속 주소는 외부(카카오 검색 결과)에서 온다. http(s)만 링크·이미지로 쓴다 (javascript: 같은 스킴 차단)
const safeUrl = (u) => (/^https?:\/\//.test(u ?? "") ? u : null);
const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
// 같은 CSS 등장 애니메이션을 다시 재생한다. 클래스를 뗐다가 리플로 후 다시 붙여야 브라우저가 새로 시작한다
const replay = (el) => {
  el.classList.remove("enter");
  void el.offsetWidth;
  el.classList.add("enter");
};

const cfg = await getJSON("data/menus.json");
// 위치: 주소의 ?at= → 지난번 고른 위치 → 첫 위치. 주소로 공유하면 같은 위치가 열린다
const remembered = (() => { try { return localStorage.getItem("at"); } catch { return null; } })();
const wanted = new URLSearchParams(location.search).get("at") ?? remembered;
const loc = cfg.locations.find((l) => l.id === wanted) ?? cfg.locations[0];
try { localStorage.setItem("at", loc.id); } catch {}
const data = await getJSON(`data/restaurants-${loc.id}.json`);

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

const shopCount = Object.keys(shops).length;
const updated = hasData && new Date(data.updated).toLocaleDateString("ko-KR", { month: "long", day: "numeric" });
$("#updated").textContent = hasData ? `, ${updated} 갱신` : "";
$("#hero-sub").textContent = `${loc.name} 반경 ${cfg.radius}m 안의 ${hasData ? `식당 ${shopCount}곳` : "식당"}을 여럿이 함께, 또는 룰렛이나 월드컵으로 골라요.`;

// 위치 전환: 고른 위치로 주소를 바꿔 다시 연다. 데이터·게임 상태가 위치마다 달라서 새로 여는 게 제일 단순하다
$("#locs").replaceChildren(
  ...cfg.locations.map((l) =>
    h("a", { className: "loc", href: `?at=${l.id}`, textContent: l.label, ariaCurrent: l.id === loc.id ? "true" : null })),
);

// ---- 첫 화면 사진 벽: 열마다 같은 사진을 두 벌 깔아 CSS로 끝없이 흘린다 ----
function buildWall() {
  const photos = shuffle(Object.values(shops).filter((s) => safeUrl(s.photo))).slice(0, 32);
  if (photos.length < 8) return $(".wall-stage").remove();
  const cols = [0, 1, 2, 3].map((c) => photos.filter((_, i) => i % 4 === c));
  $("#wall").replaceChildren(
    ...cols.map((col, c) =>
      h("div", { className: "wall-col", style: `--dur:${44 + c * 7}s` },
        ...[...col, ...col].map((s) => h("img", { src: s.photo, alt: "", decoding: "async" })),
      )),
  );
}

// 스크롤해서 들어온 패널은 떠오르고, 사진 벽은 화면 밖에 있으면 멈춘다
const watch = new IntersectionObserver((entries) => {
  for (const e of entries) {
    if (e.target.id === "wall") e.target.classList.toggle("paused", !e.isIntersecting);
    else if (e.isIntersecting) {
      e.target.classList.add("in");
      watch.unobserve(e.target);
    }
  }
}, { threshold: 0.12 });

// ---- 탭 · 종목 ----
document.querySelectorAll("[data-tab]").forEach((tab) => {
  tab.onclick = () => {
    $(".seg").dataset.active = tab.dataset.tab; // CSS가 선택 표시를 미끄러뜨린다
    document.querySelectorAll("[data-tab]").forEach((t) => {
      t.ariaSelected = String(t === tab);
      $(`#${t.dataset.tab}`).hidden = t !== tab;
    });
    $("#chips").hidden = tab.dataset.tab === "group"; // 함께 탭은 목록이 이미 종목별로 묶여 있어 칩이 필요 없다
    replay($(`#${tab.dataset.tab}`));
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

// 사진 자리. 사진이 없거나 깨지면 뒤에 깔린 포크·나이프 아이콘이 보인다
const pic = (shop, className = "") =>
  h("div", { className: `pic ${className}` },
    h("i", { className: "ph ph-fork-knife", ariaHidden: "true" }),
    safeUrl(shop?.photo) ? h("img", { src: shop.photo, alt: "", onerror: (e) => e.target.remove() }) : "",
  );
const tile = (s) => h("figure", { className: "tile" }, pic(s), h("figcaption", { textContent: s.name }));

// ---- 사진 릴: 당첨은 호출하는 쪽이 미리 뽑고, 릴은 거기에 멈추는 연출만 한다. 룰렛과 함께 고르기가 같이 쓴다 ----
let spinning = false;

function reelOf(reelEl) {
  const strip = reelEl.querySelector(".strip");
  let target = -1;
  let onLand = null;
  const land = () => {
    strip.children[target]?.classList.add("on");
    strip.classList.add("done");
    const done = onLand;
    onLand = null;
    done?.();
  };
  strip.addEventListener("transitionend", (e) => e.target === strip && e.propertyName === "transform" && land());
  return {
    show(items) {
      strip.classList.remove("moving", "done");
      strip.style.transform = "";
      strip.replaceChildren(...items.map(tile));
    },
    spin(items, winner, done) {
      const r = reelStrip(items, winner);
      target = r.target;
      onLand = done;
      strip.classList.remove("moving", "done");
      strip.style.transform = "translateX(0)";
      strip.replaceChildren(...r.items.map(tile));
      const t = strip.children[target];
      const jitter = (Math.random() - 0.5) * t.offsetWidth * 0.6; // 칸 가운데서 살짝 비껴 멈춰야 진짜 같다
      const x = t.offsetLeft + t.offsetWidth / 2 - reelEl.clientWidth / 2 + jitter; // offsetLeft 읽기가 리플로를 강제해 transition이 처음부터 돈다
      strip.classList.add("moving");
      strip.style.transform = `translateX(${-x}px)`;
      if (reducedMotion()) land();
    },
  };
}

// ---- 룰렛: 종목의 식당 전체에서 균등하게 하나 ----
const roulette = reelOf($("#reel"));

function drawReel() {
  if (spinning) return;
  const all = shopPool();
  roulette.show(shuffle(all).slice(0, 12));
  $("#roulette-hint").textContent = all.length ? `근처 식당 ${all.length}곳 전체에서 뽑아요` : "식당 데이터가 아직 없어요";
  $("#spin").disabled = !all.length;
}

$("#spin").onclick = () => {
  const all = shopPool();
  if (spinning || !all.length) return;
  spinning = true;
  $("#spin").disabled = true;
  const winner = all[Math.floor(Math.random() * all.length)];
  roulette.spin(all, winner, () => {
    spinning = false;
    $("#spin").disabled = false;
    renderGroup();
    showResult("ph-dice-five", "룰렛이 골랐어요", winner.name, [winner]);
  });
};

// ---- 함께 고르기: 사람마다 식당을 고르거나 랜덤, 고른 식당들 중에서 뽑기 ----
const groupReel = reelOf($("#group-reel"));
let picks = [null, null, null]; // 식당 id
let shownRows = 0; // 새로 생긴 줄만 등장 애니메이션
let flashRow = -1; // 방금 바뀐 줄 강조
const shopIds = Object.keys(shops);

// 식당마다 걸린 메뉴(카탈로그 순서). 첫 메뉴의 종목으로 목록을 묶는다
const menusOfShop = {};
for (const m of all) for (const s of placesOf(m)) (menusOfShop[s.id] ??= []).push(m);
const shortName = (s) => s.name.replace(/\s+\S+점$/, ""); // '우장관 과천점' → '우장관'. 반경 500m 안이라 지점명이 없어도 헷갈리지 않는다
const menusText = (s) => {
  const ms = menusOfShop[s.id] ?? [];
  return ms.slice(0, 2).join(", ") + (ms.length > 2 ? " 외" : "");
};
const shopLabel = (s) => (menusText(s) ? `${shortName(s)} (${menusText(s)})` : shortName(s));
const shopGroups = Object.keys(categories)
  .map((c) => [c, Object.values(shops).filter((s) => categoryOf[menusOfShop[s.id]?.[0]] === c).sort((a, b) => a.distance - b.distance)])
  .filter(([, list]) => list.length);

const shopSelect = (value, i) =>
  h("select", { className: "menu-select", onchange: (e) => setPick(i, e.target.value || null, true) },
    h("option", { value: "", textContent: "식당 고르기" }),
    ...shopGroups.map(([c, list]) =>
      h("optgroup", { label: c }, ...list.map((s) => h("option", { value: s.id, textContent: shopLabel(s), selected: s.id === value })))),
  );

function setPick(i, id, refocus = false) {
  picks[i] = id;
  flashRow = i;
  renderGroup();
  if (refocus) $("#picks").children[i]?.querySelector("select").focus(); // 다시 그려도 키보드 위치를 잃지 않게
}

function setCount(n) {
  picks = resizePicks(picks, Math.min(10, Math.max(2, n)));
  replay($("#count"));
  renderGroup();
}

function renderGroup() {
  const n = picks.length;
  const chosen = picks.filter(Boolean).length;
  $("#count").textContent = n;
  $("#minus").disabled = n <= 2;
  $("#plus").disabled = n >= 10;
  $("#picks").replaceChildren(
    ...picks.map((id, i) =>
      h("li", {
        className: ["pick", id ? "" : "unset", i >= shownRows ? "new" : "", i === flashRow ? "flash" : ""].join(" "),
        style: `--i:${Math.max(0, i - shownRows)}`,
      },
        pic(shops[id], "thumb"),
        h("label", { className: "pick-body" },
          h("span", { className: "who", textContent: `${i + 1}번` }),
          h("strong", { className: "pick-name", textContent: id ? shortName(shops[id]) : "식당 고르기" }),
          id ? h("span", { className: "pick-menus", textContent: menusText(shops[id]) }) : "",
          shopSelect(id, i), // 투명하게 위에 겹쳐 두어 줄 전체를 누르면 목록이 열린다
          h("i", { className: "ph ph-caret-down", ariaHidden: "true" }),
        ),
        h("button", { className: "icon-btn", ariaLabel: `${i + 1}번 식당 랜덤으로 고르기`, onclick: () => setPick(i, rerollPick(picks, i, shopIds)[i]) },
          h("i", { className: "ph ph-dice-five" })),
      )),
  );
  shownRows = n;
  flashRow = -1;
  $("#group-hint").textContent = chosen < n ? `${n}명 중 ${chosen}명 골랐어요` : "다 골랐어요. 같은 식당이 많을수록 잘 뽑혀요";
  $("#fill").disabled = chosen === n;
  $("#draw").disabled = spinning || chosen < n;
}

$("#minus").onclick = () => setCount(picks.length - 1);
$("#plus").onclick = () => setCount(picks.length + 1);
$("#fill").onclick = () => {
  const before = picks;
  picks = fillEmpty(picks, shopIds);
  flashRow = before.findIndex((m) => !m); // 첫 빈 칸을 강조
  renderGroup();
};

$("#draw").onclick = () => {
  if (spinning || picks.some((m) => !m)) return;
  spinning = true;
  renderGroup();
  $("#spin").disabled = true;
  const reelEl = $("#group-reel");
  reelEl.hidden = false;
  replay(reelEl);
  const tickets = picks.map((id) => shops[id]); // 한 사람 = 한 장
  const winner = tickets[Math.floor(Math.random() * tickets.length)];
  groupReel.spin(tickets, winner, () => {
    spinning = false;
    $("#spin").disabled = !shopPool().length;
    renderGroup();
    const votes = picks.filter((id) => id === winner.id).length;
    showResult("ph-users-three", `${picks.length}명 중 ${votes}명이 고른 식당`, winner.name, [winner]);
  });
};

// ---- 월드컵: 종목의 식당끼리 토너먼트 ----
let bracket = null;
let choosing = false;

// 고른 카드는 튀어 오르고 다른 카드는 가라앉은 뒤 다음 대결로 넘어간다
async function choose(el, shop) {
  if (choosing) return;
  choosing = true;
  const other = [...el.parentElement.querySelectorAll(".card")].find((c) => c !== el);
  if (!reducedMotion()) {
    // 탭이 가려지면 애니메이션이 멈춰 finished가 안 온다. 0.4초 넘게 기다리지 않는다
    await Promise.race([
      Promise.all([
        el.animate([{ transform: "scale(1)" }, { transform: "scale(1.06)" }],
          { duration: 320, easing: "cubic-bezier(.34, 1.56, .64, 1)", fill: "forwards" }).finished,
        other.animate([{ opacity: 1 }, { opacity: 0, transform: "scale(.9) translateY(10px)" }],
          { duration: 260, easing: "ease-in", fill: "forwards" }).finished,
      ]),
      new Promise((r) => setTimeout(r, 400)),
    ]);
  }
  choosing = false;
  bracket = pick(bracket, shop);
  renderWorldcup();
}

const card = (shop, i) =>
  h("button", { className: "card", style: `--i:${i}`, onclick: (e) => choose(e.currentTarget, shop) },
    pic(shop),
    h("strong", { textContent: shortName(shop) }),
    h("small", { textContent: [menusText(shop), `${shop.distance}m`].filter(Boolean).join(" · ") }),
  );

function renderWorldcup() {
  const box = $("#wc");
  if (!bracket) {
    const n = shopPool().length, sizes = sizesFor(n);
    box.replaceChildren(
      sizes.length
        ? h("p", { className: "hint", textContent: `식당 ${n}곳으로 몇 강을 할까요?` })
        : h("p", { className: "hint warn", textContent: `식당이 ${n}곳뿐이라 8강을 못 만들어요. 전체나 룰렛으로 골라보세요.` }),
      h("div", { className: "sizes" },
        ...sizes.map((s, i) =>
          h("button", { className: "size", style: `--i:${i}`, onclick: () => { bracket = startBracket(shopPool(), s); renderWorldcup(); } },
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
    showResult("ph-trophy", "월드컵 우승", win.name, [win]);
    return;
  }
  const { round, i } = bracket;
  box.replaceChildren(
    h("div", { className: "round" },
      h("strong", { textContent: roundName(round.length) }),
      h("span", { textContent: `${i / 2 + 1} / ${round.length / 2}` }),
    ),
    h("div", { className: "match" }, card(round[i], 0), h("span", { className: "vs", textContent: "VS" }), card(round[i + 1], 1)),
  );
}

// ---- 결과: 식당 목록 + 지도 ----
function showResult(icon, label, title, list) {
  $("#result-empty").hidden = true;
  const body = $("#result-body");
  body.hidden = false;
  replay(body);
  $("#result-label").replaceChildren(h("i", { className: `ph-fill ${icon}` }), label);
  $("#result-title").textContent = title;
  $("#places").replaceChildren(
    ...(list.length
      ? list.map((r, idx) =>
          h("li", { style: `--i:${idx}` },
            pic(r, "thumb"),
            h("button", { className: "place", onclick: () => focusMarker(idx) },
              h("strong", { textContent: r.name }),
              h("span", { textContent: `${r.category} · ${r.distance}m` }),
            ),
            h("div", { className: "links" },
              safeUrl(r.url) ? h("a", { className: "go", href: r.url, target: "_blank", rel: "noopener" }, "카카오맵", h("i", { className: "ph ph-arrow-up-right" })) : "",
              safeUrl(r.photoSource) ? h("a", { className: "source", href: r.photoSource, target: "_blank", rel: "noopener noreferrer", textContent: "사진 출처" }) : "",
            ),
          ))
      : [h("li", { className: "none", textContent: hasData ? "반경 안 식당이 없어요" : "식당 데이터가 아직 없어요" })]),
  );
  drawMap(list);
  if (!matchMedia("(min-width: 960px)").matches) $("#result").scrollIntoView({ block: "start" }); // 넓은 화면은 결과가 옆에 고정돼 있다. 부드러운 스크롤은 CSS scroll-behavior가 맡는다
}

// 지도: Leaflet + OpenStreetMap 타일. API 키가 필요 없다
let map = null;
let layer = null;
let markers = [];

function drawMap(list) {
  if (!window.L) return; // CDN이 막히면 목록만 보여준다
  $("#map").hidden = false;
  const home = [loc.lat, loc.lng];
  const icon = (name, className, size, anchor) =>
    L.divIcon({ html: `<i class="ph-fill ${name}"></i>`, className, iconSize: [size, size], iconAnchor: anchor, popupAnchor: [0, -24] });
  if (!map) {
    const accent = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim();
    map = L.map("map").setView(home, 16);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap" }).addTo(map);
    L.circle(home, { radius: cfg.radius, color: accent, weight: 1.5, fillOpacity: 0.06 }).addTo(map);
    L.marker(home, { title: loc.name, icon: icon("ph-buildings", "me", 34) }).addTo(map);
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

buildWall();
renderChips();
drawReel();
renderWorldcup();
renderGroup();
document.querySelectorAll(".reveal, #wall").forEach((el) => watch.observe(el));
