import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from collect import distance_m, nearby  # noqa: E402

center = {"lat": 37.4174009, "lng": 126.9775157}
item = lambda title, x, y, road="과천대로7길 1": {
    "title": title, "category": "한식>찌개,전골", "address": "", "roadAddress": road,
    "mapx": str(x), "mapy": str(y),
}

# 위도 0.001도 ≈ 111m
assert 105 < distance_m(37.0, 127.0, 37.001, 127.0) < 117

items = [
    item("<b>김치</b>찌개 &amp; 백반", 1269775157, 374183009),       # 약 100m
    item("<b>김치</b>찌개 &amp; 백반", 1269775157, 374183009),       # 중복
    item("가까운집", 1269775157, 374174909),                         # 약 10m
    item("먼집", 1269775157, 374274009),                             # 약 1.1km
]
got = nearby(items, center, 500)
assert [r["name"] for r in got] == ["가까운집", "김치찌개 & 백반"], got
assert 95 <= got[1]["distance"] <= 105, got[1]
assert got[1]["lat"] == 37.4183009 and got[1]["lng"] == 126.9775157
print("ok")
