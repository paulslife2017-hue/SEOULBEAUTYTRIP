# 반복 미적용 원인 규명 (작업 0)

## 결론: 원인은 "데이터 소스 이원화"

### 1. 빌드/렌더링 방식
- **SSR (요청 시 생성)**: Hono + Cloudflare Pages/Vercel. 빌드 타임 정적 생성 없음.
- ISR/캐시 이슈 아님. `?nocache=` 쿼리 붙여도 동일 결과 확인.

### 2. 핵심 원인 — 출력 경로 이원화

| 출력 지점 | 소스 | 상태 |
|-----------|------|------|
| `<title>`, `<meta>`, `og:title` | `_areaFinal` 변수 (shop.location 기반) | ✅ 이미 정상 |
| `sp-cat-badge` (헤더 칩) | `shop.location.split(',')[0] + " Seoul"` 하드코딩 | ❌ "Seocho Seoul" 발생 원인 |
| breadcrumb HTML (비주얼) | `/best/${_bcCatSlug}/gangnam` 하드코딩 | ❌ gangnam 고정 |
| breadcrumb JSON-LD | 3차에서 `_bcAreaSlug`로 수정됨 | ✅ 정상 |
| DB `seo_text` 필드 | AI 생성 시점의 보일러플레이트 문자열 | ❌ comprehensive range 잔존 |
| `availableAreaLinks` | AREA_LABELS 전체 (업체 수 미확인) | ❌ 빈 지역도 링크 노출 |

### 3. 반복 미적용 패턴
- 3차 지시서에서 "Seoul Seoul" 수정 → `metaDescription` 런타임 replace만 적용
- 실제 "Seocho Seoul"은 `sp-cat-badge`에서 발생 (다른 출력 경로)
- 브레드크럼 JSON-LD는 수정됐으나 HTML 비주얼 브레드크럼(line 4498)은 별도 코드라인으로 미수정

### 4. 재발 방지책
1. 지역명 출력 시 항상 `_shopArea` 단일 변수 참조 (` Seoul` suffix 직접 붙이기 금지)
2. `best/${catSlug}/gangnam` 패턴 grep으로 잔존 하드코딩 주기적 점검
3. DB `seo_text` 내 보일러플레이트는 저장 시점이 아니라 **렌더링 시 런타임 replace**로 정제
4. `availableAreaLinks`는 반드시 DB 업체 수 쿼리 후 필터링

## 4차 수정 내역 요약
- `sp-cat-badge`: `${_shopArea} Seoul` → `${_shopArea}` (Seoul 제거)
- 브레드크럼 HTML: `/best/${_bcCatSlug}/gangnam` → `/best/${_bcCatSlug}/seoul`
- 브레드크럼 JSON-LD: 동일하게 seoul로 통일
- `availableAreaLinks`: DB 집계 후 업체 > 0 지역만 표시
- `cleanSeo`: `comprehensive range` 문장 + `Why Foreigners Choose` H2+단락 런타임 제거
