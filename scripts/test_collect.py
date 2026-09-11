import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from collect import nearby  # noqa: E402


def doc(id, name, distance, road="경기 과천시 과천대로7길 1"):
    return {
        "id": id, "place_name": name, "category_name": "음식점 > 한식 > 찌개,전골",
        "address_name": "경기 과천시 갈현동 1", "road_address_name": road,
        "x": "126.9775157", "y": "37.4183009", "distance": distance,
        "place_url": f"http://place.map.kakao.com/{id}",
    }


docs = [
    doc("1", "김치찌개집", "100"),
    doc("1", "김치찌개집", "100"),  # 같은 id — 중복
    doc("2", "가까운집", "10", road=""),
    doc("3", "먼집", "1100"),
    doc("4", "거리없음", ""),
]
got = nearby(docs, 500)
assert [r["name"] for r in got] == ["가까운집", "김치찌개집"], got
assert got[0]["address"] == "경기 과천시 갈현동 1"  # 도로명 없으면 지번
assert got[1] == {
    "name": "김치찌개집", "category": "한식 > 찌개,전골", "address": "경기 과천시 과천대로7길 1",
    "lat": 37.4183009, "lng": 126.9775157, "distance": 100, "url": "https://place.map.kakao.com/1",
}, got[1]
print("ok")
