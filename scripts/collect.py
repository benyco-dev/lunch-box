"""카카오 로컬 키워드 검색 → site/data/restaurants.json

메뉴 이름을 중심점 반경 안 음식점(FD6)으로 검색해 메뉴별 식당 목록을 만든다.
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
API = "https://dapi.kakao.com/v2/local/search/keyword.json"
MAX_PAGE = 3  # 카카오는 쿼리당 15건 × 3페이지 = 45건까지만 준다


def slim(doc):
    """카카오 응답 한 건을 사이트가 쓰는 모양으로 좁힌다. 원본 스키마는 여기서만 안다."""
    return {
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
        params = {
            "query": query, "category_group_code": "FD6", "x": center["lng"], "y": center["lat"],
            "radius": radius, "sort": "distance", "page": page, "size": 15,
        }
        req = urllib.request.Request(f"{API}?{urllib.parse.urlencode(params)}", headers={"Authorization": f"KakaoAK {key}"})
        with urllib.request.urlopen(req, timeout=10) as res:
            body = json.load(res)
        docs += body["documents"]
        time.sleep(0.1)
        if body["meta"]["is_end"]:
            break
    return docs


def main():
    key = os.environ.get("KAKAO_REST_API_KEY")
    if not key:
        sys.exit("KAKAO_REST_API_KEY 환경변수가 필요합니다")

    cfg = json.loads((DATA / "menus.json").read_text())
    center, radius = cfg["center"], cfg["radius"]
    menus = {}
    for names in cfg["categories"].values():
        for menu in names:
            menus[menu] = nearby(search(menu, center, radius, key), radius)
            print(f"{menu}: {len(menus[menu])}")

    total = len({(r["name"], r["address"]) for rs in menus.values() for r in rs})
    if total == 0:
        sys.exit("반경 안 식당이 0건 — 키나 좌표를 확인하세요. 기존 데이터를 덮어쓰지 않습니다.")

    out = {"center": center, "radius": radius, "updated": date.today().isoformat(), "menus": menus}
    (DATA / "restaurants.json").write_text(json.dumps(out, ensure_ascii=False, indent=1) + "\n")
    print(f"식당 {total}곳 (메뉴 {sum(1 for v in menus.values() if v)}/{len(menus)}개에 식당 있음)")


if __name__ == "__main__":
    main()
