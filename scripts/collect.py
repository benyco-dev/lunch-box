"""카카오 로컬 키워드 검색 + 블로그 검색 → site/data/restaurants-<위치 id>.json

menus.json 의 위치마다, 메뉴 이름을 중심점 반경 안 음식점(FD6)으로 검색해 메뉴별 식당 목록을 만들고,
식당마다 그 식당 후기 블로그 글의 대표 사진을 붙인다.

    python3 scripts/collect.py              # 모든 위치
    python3 scripts/collect.py gangnam      # 그 위치만
"""
import html
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request
from datetime import date
from pathlib import Path

DATA = Path(__file__).resolve().parent.parent / "site" / "data"
LOCAL = "https://dapi.kakao.com/v2/local/search/keyword.json"
BLOG = "https://dapi.kakao.com/v2/search/blog"
MAX_PAGE = 3  # 카카오는 쿼리당 15건 × 3페이지 = 45건까지만 준다


def get(url, params, key):
    req = urllib.request.Request(f"{url}?{urllib.parse.urlencode(params)}", headers={"Authorization": f"KakaoAK {key}"})
    with urllib.request.urlopen(req, timeout=10) as res:
        body = json.load(res)
    time.sleep(0.1)
    return body


def slim(doc):
    """카카오 응답 한 건을 사이트가 쓰는 모양으로 좁힌다. 원본 스키마는 여기서만 안다."""
    return {
        "id": doc["id"],
        "name": doc["place_name"],
        "category": doc["category_name"].removeprefix("음식점 > "),
        "address": doc["road_address_name"] or doc["address_name"],
        "lat": float(doc["y"]),
        "lng": float(doc["x"]),
        "distance": int(doc["distance"]),
        "url": doc["place_url"].replace("http://", "https://", 1),
    }


def nearby(docs, radius):
    """반경 안만, 장소 id로 중복 제거, 가까운 순."""
    seen, out = set(), []
    for d in docs:
        if d["id"] not in seen and d["distance"] and int(d["distance"]) <= radius:
            seen.add(d["id"])
            out.append(slim(d))
    return sorted(out, key=lambda r: r["distance"])


def search(query, center, radius, key):
    docs = []
    for page in range(1, MAX_PAGE + 1):
        body = get(LOCAL, {
            "query": query, "category_group_code": "FD6", "x": center["lng"], "y": center["lat"],
            "radius": radius, "sort": "distance", "page": page, "size": 15,
        }, key)
        docs += body["documents"]
        if body["meta"]["is_end"]:
            break
    return docs


def squash(text):
    """태그·HTML 엔티티·공백을 걷어낸 소문자. 이름 비교용."""
    return re.sub(r"\s+", "", html.unescape(re.sub(r"<[^>]+>", "", text))).lower()


def base_name(name):
    """'서울현방 과천점' → '서울현방'. 지점명은 후기 글마다 표기가 제각각이라 뺀다."""
    return re.sub(r"\s+\S+점$", "", name)


def pick_photo(docs, name, region_words, exclude=()):
    """제목·본문에 식당 이름과 지역 단어가 둘 다 있는 글의 대표 사진(130px)과 글 링크.
    이미지 검색은 제목·본문이 없어 식당과 무관한 사진이 섞였다. 맞는 글이 없으면 사진 없음이 낫다.
    exclude: 사람 얼굴이 나오는 등 쓰면 안 되는 글 URL (menus.json photoExclude)."""
    want = squash(base_name(name))
    for d in docs:
        text = squash(d["title"] + d["contents"])
        if d["thumbnail"] and d["url"] not in exclude and want in text and any(squash(w) in text for w in region_words):
            return d["thumbnail"], d["url"]
    return None, None


def photo(shop, region_words, exclude, key):
    query = f"{base_name(shop['name'])} {region_words[0]}"
    docs = get(BLOG, {"query": query, "size": 10}, key)["documents"]
    return pick_photo(docs, shop["name"], region_words, exclude)


def collect(loc, cfg, key):
    """한 위치의 메뉴별 식당 id 목록과 식당(대표 사진 포함)."""
    radius = cfg["radius"]
    shops, menus = {}, {}
    for names in cfg["categories"].values():
        for menu in names:
            found = nearby(search(menu, loc, radius, key), radius)
            menus[menu] = [r["id"] for r in found]
            shops.update((r["id"], r) for r in found)
    for s in shops.values():
        s["photo"], s["photoSource"] = photo(s, loc["regionWords"], cfg.get("photoExclude", ()), key)
    return shops, menus


def main():
    key = os.environ.get("KAKAO_REST_API_KEY")
    if not key:
        sys.exit("KAKAO_REST_API_KEY 환경변수가 필요합니다")

    cfg = json.loads((DATA / "menus.json").read_text())
    only = sys.argv[1:]
    for loc in cfg["locations"]:
        if only and loc["id"] not in only:
            continue
        shops, menus = collect(loc, cfg, key)
        if not shops:
            sys.exit(f"{loc['label']}: 반경 안 식당이 0건. 키나 좌표를 확인하세요. 기존 데이터를 덮어쓰지 않습니다.")
        out = {"location": loc["id"], "updated": date.today().isoformat(), "restaurants": shops, "menus": menus}
        (DATA / f"restaurants-{loc['id']}.json").write_text(json.dumps(out, ensure_ascii=False, indent=1) + "\n")
        print(f"{loc['label']}: 식당 {len(shops)}곳, 사진 {sum(1 for s in shops.values() if s['photo'])}곳 "
              f"(메뉴 {sum(1 for v in menus.values() if v)}/{len(menus)}개에 식당 있음)")


if __name__ == "__main__":
    main()
