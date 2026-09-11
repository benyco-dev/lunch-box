"""네이버 지역 검색 → site/data/restaurants.json

메뉴마다 "<지역> <메뉴>" 로 검색해 중심점 반경 안의 식당만 남긴다.
네이버 지역 검색은 쿼리당 최대 5건이라 지역 키워드를 여러 개 돌려 커버리지를 늘린다.
"""
import html
import json
import math
import os
import re
import sys
import time
import urllib.parse
import urllib.request
from datetime import date
from pathlib import Path

DATA = Path(__file__).resolve().parent.parent / "site" / "data"
API = "https://openapi.naver.com/v1/search/local.json"


def distance_m(lat1, lng1, lat2, lng2):
    r = 6371000
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = p2 - p1, math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def slim(item, center):
    """네이버 응답 한 건을 사이트가 쓰는 모양으로 좁힌다. 원본 스키마는 여기서만 안다."""
    lng, lat = int(item["mapx"]) / 1e7, int(item["mapy"]) / 1e7  # WGS84 × 10^7
    return {
        "name": html.unescape(re.sub(r"<[^>]+>", "", item["title"])),
        "category": item.get("category", ""),
        "address": item.get("roadAddress") or item.get("address", ""),
        "lat": round(lat, 7),
        "lng": round(lng, 7),
        "distance": round(distance_m(center["lat"], center["lng"], lat, lng)),
    }


def nearby(items, center, radius):
    """반경 안만, 이름+주소로 중복 제거, 가까운 순."""
    seen, out = set(), []
    for it in items:
        r = slim(it, center)
        key = (r["name"], r["address"])
        if r["distance"] <= radius and key not in seen:
            seen.add(key)
            out.append(r)
    return sorted(out, key=lambda r: r["distance"])


def search(query, client_id, secret):
    url = API + "?" + urllib.parse.urlencode({"query": query, "display": 5})
    req = urllib.request.Request(url, headers={
        "X-Naver-Client-Id": client_id,
        "X-Naver-Client-Secret": secret,
    })
    with urllib.request.urlopen(req, timeout=10) as res:
        return json.load(res)["items"]


def main():
    client_id = os.environ.get("NAVER_SEARCH_CLIENT_ID")
    secret = os.environ.get("NAVER_SEARCH_CLIENT_SECRET")
    if not client_id or not secret:
        sys.exit("NAVER_SEARCH_CLIENT_ID / NAVER_SEARCH_CLIENT_SECRET 환경변수가 필요합니다")

    cfg = json.loads((DATA / "menus.json").read_text())
    center, radius = cfg["center"], cfg["radius"]
    menus = {}
    for names in cfg["categories"].values():
        for menu in names:
            items = []
            for area in cfg["areas"]:
                items += search(f"{area} {menu}", client_id, secret)
                time.sleep(0.12)  # 초당 10회 제한
            menus[menu] = nearby(items, center, radius)
            print(f"{menu}: {len(menus[menu])}")

    total = sum(len(v) for v in menus.values())
    if total == 0:
        sys.exit("반경 안 식당이 0건 — 키워드나 좌표를 확인하세요. 기존 데이터를 덮어쓰지 않습니다.")

    out = {"center": center, "radius": radius, "updated": date.today().isoformat(), "menus": menus}
    (DATA / "restaurants.json").write_text(json.dumps(out, ensure_ascii=False, indent=1) + "\n")
    print(f"총 {total}건 (메뉴 {sum(1 for v in menus.values() if v)}/{len(menus)}개에 식당 있음)")


if __name__ == "__main__":
    main()
