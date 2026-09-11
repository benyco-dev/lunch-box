# 🍱 점심 뭐 먹지?

회사 근처 반경 500m 식당으로 점심 메뉴를 고르는 정적 사이트.

* **룰렛** — 종목(한식·중식·일식…)을 고르고 돌린다
* **메뉴 월드컵** — 종목별 8강 / 16강 / 32강 토너먼트로 직접 고른다
* 정해진 메뉴의 **근처 식당 목록 + 네이버 지도**

서버 없이 Cloud Storage 버킷 하나로 서빙하고, GitHub Actions가 매월 식당을 다시 수집해 배포한다.

```
GitHub Actions ─ 네이버 지역 검색 → site/data/restaurants.json ─(WIF, 키 파일 없음)→ GCS 버킷 → 공개 URL
브라우저 ─ NAVER Maps JS (지도 표시만)
```

## 구조

```
site/data/menus.json        메뉴 카탈로그 + 중심 좌표·반경·검색 지역. 수집기와 사이트가 같이 읽는다
scripts/collect.py          수집   네이버 지역 검색 → site/data/restaurants.json
scripts/test_collect.py     검증   좌표 변환·거리·반경 필터·중복 제거
site/game.js                도메인 순수 함수(토너먼트·룰렛 각도). DOM·fetch 없음
scripts/test_game.mjs       검증   브래킷 진행·룰렛 정지 위치
site/app.js                 표현   game.js 결과와 JSON을 그리기만 함
```

* **수집 ↔ 사이트**: `restaurants.json` 이 유일한 접점. 네이버 응답 스키마는 `collect.py` 의 `slim()` 에서
  `{name, category, address, lat, lng, distance}` 로 좁혀지고 바깥으로 새지 않는다.
  나중에 다른 지도 API로 바꿔도 `slim()` 과 `search()` 만 고치면 된다.
* **도메인 ↔ 표현**: `game.js` 는 브라우저와 node 테스트에서 같은 코드로 돈다.
* 식당이 0곳인 메뉴는 게임에 올리지 않는다. 월드컵 크기는 종목의 메뉴 수로 제한된다.

### 네이버 지역 검색의 한계

쿼리당 **최대 5건**, 반경 검색 파라미터가 없다. 그래서 `"<지역> <메뉴>"` 를
`menus.json` 의 `areas` 개수만큼 검색하고, 좌표로 거리를 계산해 반경 밖을 버린다.
메뉴 약 90개 × 지역 3개 = 월 1회 270여 호출(일 한도 25,000).
놓치는 식당이 있으면 `areas` 에 키워드를 추가한다.

## 로컬 실행

```bash
cp .env.example .env                                # 키 채우기
set -a; source .env; set +a
python3 scripts/collect.py                          # 식당 수집
printf 'export default { naverMapKeyId: "%s" };\n' "$NAVER_MAP_KEY_ID" > site/config.js
python3 -m http.server 8000 -d site                 # http://localhost:8000
```

의존성 없음. Python 3, Node 18+ 표준 라이브러리만 쓴다. `site/config.js` 가 없으면 지도만 빠지고 나머지는 동작한다.

## API 키 발급

| 키 | 발급처 | 노출 |
| --- | --- | --- |
| `NAVER_SEARCH_CLIENT_ID` / `_SECRET` | [NAVER Developers](https://developers.naver.com/apps) → 애플리케이션 등록 → 검색 API | CI에서만. 사이트에 안 나감 |
| `NAVER_MAP_KEY_ID` | [NAVER Cloud Platform](https://console.ncloud.com) → Maps → Application 등록 → Dynamic Map | 브라우저에 노출되는 키. **Web 서비스 URL 제한 필수** |

Maps 앱의 Web 서비스 URL에 `https://storage.googleapis.com` 과 `http://localhost:8000` 을 등록한다.

## 배포 인프라 (GCP)

버킷 공개 호스팅·WIF 무키 배포 절차는 [lottery](https://github.com/benyco-dev/lottery) 저장소 README와 같다.

```bash
PROJECT_ID=<your-project-id>
BUCKET=<your-bucket>
REPO=<owner>/<repo>
```

1. 프로젝트 생성 + 결제 연결, `storage` · `iamcredentials` · `sts` API 활성화
2. 버킷 생성(`--uniform-bucket-level-access`, `asia-northeast3`), `allUsers` → `roles/storage.objectViewer`
3. 서비스 계정 `gha-deploy` 에 버킷 `objectAdmin` + `legacyBucketReader`
4. WIF 풀 `github` / 프로바이더 `github-actions`, `--attribute-condition="assertion.repository=='$REPO'"`

### 저장소 시크릿

| 시크릿 | 값 |
| --- | --- |
| `GCP_WIF_PROVIDER` | `projects/<프로젝트번호>/locations/global/workloadIdentityPools/github/providers/github-actions` |
| `GCP_SA_EMAIL` | `gha-deploy@<프로젝트ID>.iam.gserviceaccount.com` |
| `GCS_BUCKET` | 버킷 이름 |
| `NAVER_SEARCH_CLIENT_ID` / `NAVER_SEARCH_CLIENT_SECRET` | 네이버 검색 API |
| `NAVER_MAP_KEY_ID` | NCP Maps |

접속: `https://storage.googleapis.com/<BUCKET>/index.html` — `/index.html` 까지 붙여야 한다.

## 데이터 출처

식당 정보는 네이버 지역 검색 API, 지도는 NAVER Maps. 이 저장소는 네이버와 관련이 없다.
