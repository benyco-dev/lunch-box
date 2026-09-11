"""카카오 로컬 키워드 검색 + 이미지 검색 → site/data/restaurants.json

메뉴 이름을 중심점 반경 안 음식점(FD6)으로 검색해 메뉴별 식당 목록을 만들고,
식당마다 이미지 검색 첫 결과를 대표 사진으로 붙인다.
"""
import json
import os
import sys
import time
import urllib.parse
import urllib.request
from datetime import date
from pathlib import Path

DATA = Path(__file__).resolve().parent.parent / "site" / "data"
LOCAL = "https://dapi.kakao.com/v2/local/search/keyword.json"
IMAGE = "https://dapi.kakao.com/v2/search/image"
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


def photo(shop, key):
    """이미지 검색 첫 결과의 카카오 썸네일(130px)과 원문 링크. 원본 이미지는 블로그 핫링크 차단이 많아 안 쓴다."""
    region = shop["address"].split()[1] if len(shop["address"].split()) > 1 else ""
    docs = get(IMAGE, {"query": f"{shop['name']} {region}", "size": 1}, key)["documents"]
    return (docs[0]["thumbnail_url"], docs[0]["doc_url"]) if docs else (None, None)


def main():
    key = os.environ.get("KAKAO_REST_API_KEY")
    if not key:
        sys.exit("KAKAO_REST_API_KEY 환경변수가 필요합니다")

    cfg = json.loads((DATA / "menus.json").read_text())
    center, radius = cfg["center"], cfg["radius"]
    shops, menus = {}, {}
    for names in cfg["categories"].values():
        for menu in names:
            found = nearby(search(menu, center, radius, key), radius)
            menus[menu] = [r["id"] for r in found]
            shops.update((r["id"], r) for r in found)
            print(f"{menu}: {len(found)}")

    if not shops:
        sys.exit("반경 안 식당이 0건 — 키나 좌표를 확인하세요. 기존 데이터를 덮어쓰지 않습니다.")

    for s in shops.values():
        s["photo"], s["photoSource"] = photo(s, key)

    out = {"center": center, "radius": radius, "updated": date.today().isoformat(), "restaurants": shops, "menus": menus}
    (DATA / "restaurants.json").write_text(json.dumps(out, ensure_ascii=False, indent=1) + "\n")
    print(f"식당 {len(shops)}곳, 사진 {sum(1 for s in shops.values() if s['photo'])}곳 "
          f"(메뉴 {sum(1 for v in menus.values() if v)}/{len(menus)}개에 식당 있음)")


if __name__ == "__main__":
    main()
