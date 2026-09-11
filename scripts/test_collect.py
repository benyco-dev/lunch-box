import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from collect import base_name, nearby, pick_photo  # noqa: E402


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
    "id": "1", "name": "김치찌개집", "category": "한식 > 찌개,전골", "address": "경기 과천시 과천대로7길 1",
    "lat": 37.4183009, "lng": 126.9775157, "distance": 100, "url": "https://place.map.kakao.com/1",
}, got[1]
# 대표 사진: 이름과 지역이 둘 다 맞는 글만
assert base_name("서울현방 과천점") == "서울현방"
assert base_name("고옴탱") == "고옴탱"
region = ["과천", "지식정보타운"]
post = lambda title, contents, thumb="t", url="u": {"title": title, "contents": contents, "thumbnail": thumb, "url": url}
blogs = [
    post("<b>이화</b><b>향</b> 부천 맛집", "부천 중국집", "wrong-region"),       # 지역 불일치
    post("과천 맛집 모음", "여기저기 다녀옴", "wrong-name"),                   # 이름 없음
    post("과천 &lt;<b>이화</b><b>향</b>&gt; 후기", "짜장면", ""),              # 썸네일 없음
    post("과천 중식 &lt;<b>이화</b> <b>향</b>&gt; 후기", "탕수육", "ok", "post"),  # 태그·엔티티·띄어쓰기 달라도 매칭
]
assert pick_photo(blogs, "이화향 과천점", region) == ("ok", "post")
assert pick_photo(blogs[:3], "이화향 과천점", region) == (None, None)
assert pick_photo(blogs, "이화향 과천점", region, exclude=["post"]) == (None, None)  # 제외 목록
print("ok")
