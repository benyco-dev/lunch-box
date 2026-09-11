# 🍱 점심 뭐 먹지?

회사 근처 반경 500m 식당으로 점심 메뉴를 고르는 정적 사이트.

* **사진 룰렛** — 종목의 근처 식당 전체에서 균등하게 하나를 뽑고, 사진 띠가 흘러가다 그 식당에 멈춘다
* **메뉴 월드컵** — 종목별 8강 / 16강 / 32강 토너먼트로 직접 고른다. 카드엔 가장 가까운 식당 사진
* 정해진 메뉴의 **근처 식당 목록 + 지도**(OpenStreetMap, 키 불필요) + 카카오맵 링크

서버 없이 Cloud Storage 버킷 하나로 서빙하고, GitHub Actions가 매월 식당을 다시 수집해 배포한다.

```
GitHub Actions ─ 카카오 로컬 검색 → site/data/restaurants.json ─(WIF, 키 파일 없음)→ GCS 버킷 → 공개 URL
브라우저 ─ Leaflet + OpenStreetMap 타일 (지도 표시만, API 키 없음)
```

## 구조

```
site/data/menus.json        메뉴 카탈로그 + 중심 좌표·반경. 수집기와 사이트가 같이 읽는다
scripts/collect.py          수집   카카오 로컬 키워드 검색 + 블로그 검색(대표 사진) → site/data/restaurants.json
scripts/test_collect.py     검증   응답 변환·반경 필터·중복 제거·대표 사진 매칭
site/game.js                도메인 순수 함수(토너먼트·룰렛 각도). DOM·fetch 없음
scripts/test_game.mjs       검증   브래킷 진행·릴 당첨 칸 배치
site/app.js                 표현   game.js 결과와 JSON을 그리기만 함
```

* **수집 ↔ 사이트**: `restaurants.json` 이 유일한 접점. 카카오 응답 스키마는 `collect.py` 의 `slim()` 에서
  `{id, name, category, address, lat, lng, distance, url, photo, photoSource}` 로 좁혀지고 바깥으로 새지 않는다.
  나중에 다른 지도 API로 바꿔도 `slim()` 과 `search()` 만 고치면 된다.
* **도메인 ↔ 표현**: `game.js` 는 브라우저와 node 테스트에서 같은 코드로 돈다.
* 식당이 0곳인 메뉴는 게임에 올리지 않는다. 월드컵 크기는 종목의 메뉴 수로 제한된다.

### 왜 카카오 로컬인가

메뉴 이름을 `radius=500`, `category_group_code=FD6`(음식점)로 검색하면 메뉴별 식당 목록이 바로 나온다.
쿼리당 최대 45건(15건 × 3페이지). 메뉴 약 90개면 월 1회 수백 호출이라 무료 한도 안이다.

처음엔 네이버 지역 검색을 검토했지만 쿼리당 5건에 반경 파라미터가 없어서 뺐다.
OpenStreetMap은 반경 500m 안 식당이 3곳뿐이라 데이터 소스로는 부족했다.

## 로컬 실행

```bash
cp .env.example .env                                # 키 채우기
set -a; source .env; set +a
python3 scripts/collect.py                          # 식당 수집
python3 -m http.server 8000 -d site                 # http://localhost:8000
```

빌드 의존성 없음. Python 3, Node 18+ 표준 라이브러리만 쓴다. 지도 라이브러리 Leaflet은 cdnjs에서 SRI 해시로 고정해 불러온다.

## API 키 발급

| 키 | 발급처 | 노출 |
| --- | --- | --- |
| `KAKAO_REST_API_KEY` | [Kakao Developers](https://developers.kakao.com) → 앱 생성 → REST API 키, 제품 설정에서 카카오맵 사용 ON | CI에서만. 사이트에 안 나감 |

지도는 OpenStreetMap 타일이라 키가 필요 없고, 식당마다 카카오맵 상세 링크를 붙인다.

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
| `KAKAO_REST_API_KEY` | 카카오 REST API 키 |

접속: `https://storage.googleapis.com/<BUCKET>/index.html` — `/index.html` 까지 붙여야 한다.

## 데이터 출처

식당 정보는 카카오 로컬 API, 지도는 © OpenStreetMap 기여자. 이 저장소는 카카오와 관련이 없다.
