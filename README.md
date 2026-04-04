# Squat Map

브라우저에서 스쿼트 영상을 분석해 풀스쿼트 여부를 판별하고, 통과한 기록을 지역 기반 랭킹과 지도에 반영하는 프로젝트입니다.

이 프로젝트는 단순 업로드 폼이 아니라 아래 흐름을 하나로 묶는 데 초점을 두고 있습니다.

- 사용자가 스쿼트 영상을 업로드
- 브라우저에서 자세를 분석해 `PASS / FAIL / UNSURE` 판정
- `PASS`일 때만 기록 저장 가능
- 위치 정보는 자동으로 받아 지역 단위로만 저장
- 지역 지도, 지역별 랭킹, 전국 랭킹 제공
- 전국 5위권 변동 시 관리자 검수용 영상만 임시 저장
- 관리자는 관리자 공간에서 검수 후 기록 삭제 가능

## 기술 스택

### Frontend
- React 19
- Vite
- CSS

### 지도
- Leaflet
- React Leaflet
- 대한민국 시도 GeoJSON 경계 데이터

### 자세 분석
- MediaPipe Pose Landmarker
- WASM + WebGL 실행 환경

### 브라우저 저장소
- `localStorage`
- `IndexedDB`

## 왜 이 기술을 사용했는가

### React
UI 상태가 많기 때문입니다.

이 프로젝트는 단순 정적 페이지가 아니라 아래 상태들이 동시에 움직입니다.

- 영상 분석 결과
- PASS 여부에 따른 기록 입력 가능 상태
- 지역 선택 상태
- 전국/지역 랭킹 계산 결과
- 관리자 로그인 상태
- 관리자 검수 큐와 영상 URL 상태

이런 흐름은 컴포넌트 단위 상태 관리가 쉬운 React가 잘 맞았습니다.

### Vite
개발 속도와 반복 작업 속도를 위해 사용했습니다.

영상 업로드, 지도, 관리자 모달, 랭킹 UI를 계속 수정하면서 바로 확인해야 했기 때문에 빠른 dev server와 build 속도가 중요했습니다.

### MediaPipe Pose Landmarker
브라우저에서 바로 포즈 추정을 하기 위해 선택했습니다.

이 프로젝트는 서버에 원본 영상을 계속 보내는 구조보다, 사용자 브라우저에서 분석을 끝내고 결과만 활용하는 방식이 더 적합했습니다. MediaPipe Pose Landmarker는 다음 요구에 맞았습니다.

- 별도 서버 추론 없이 클라이언트에서 실행 가능
- 스쿼트 깊이 계산에 필요한 관절 좌표 제공
- 웹 환경에서 바로 붙이기 쉬움

실제 구현은 [src/lib/pose.js](src/lib/pose.js)에서 MediaPipe 모델을 로드하고, [src/lib/depth.js](src/lib/depth.js)에서 깊이 비율과 반복 판정을 계산합니다.

### Leaflet / React Leaflet
실제 지도 UI가 필요했기 때문입니다.

단순 지역 리스트가 아니라, 사용자가 지도에서 지역을 보고 선택할 수 있어야 했습니다. 여기에 시도 경계 강조와 지역 라벨 마커까지 필요해서 Leaflet 기반 구성이 적합했습니다.

### localStorage
일반 기록 저장은 가볍게 유지하기 위해 사용했습니다.

이 프로젝트는 현재 백엔드 없이 동작하는 구조이기 때문에, 기록 데이터는 브라우저에 저장하는 방식으로 구현했습니다. 지역, 닉네임, 기록, 메모, 인증 결과처럼 텍스트 중심 데이터는 `localStorage`에 두는 것이 단순하고 관리가 쉬웠습니다.

관련 구현은 [src/lib/records.js](src/lib/records.js)에 있습니다.

### IndexedDB
검수용 영상 저장을 위해 사용했습니다.

영상 Blob은 `localStorage`에 넣기 어렵고, 용량과 구조상 `IndexedDB`가 맞습니다. 현재는 모든 영상을 저장하지 않고, 전국 5위권 변동이 생겼을 때만 관리자 검수용 영상을 임시 저장합니다.

관련 구현은 [src/lib/videoStore.js](src/lib/videoStore.js)에 있습니다.

## 주요 기능

### 1. 브라우저 기반 풀스쿼트 판별
사용자가 올린 영상을 브라우저에서 바로 분석합니다.

- 측면 스쿼트 기준 깊이 계산
- `PASS / FAIL / UNSURE` 결과 표시
- 반복(rep)별 판정 요약 제공
- 스켈레톤 오버레이 표시

### 2. 지역 기반 기록 저장
위치 정보는 자동으로 받아 지역만 저장합니다.

- GPS 좌표 원본은 저장하지 않음
- 가장 가까운 지역으로 매핑
- 기록 저장 시 지역명만 남김

### 3. 지역 지도 및 랭킹
저장된 기록을 기반으로 지도와 랭킹을 제공합니다.

- 시도 경계 강조
- 지역 선택 기반 랭킹 필터링
- 전국 랭킹 제공
- 전국 5위까지만 메모 노출

### 4. 관리자 검수 공간
관리자만 검수 큐를 확인할 수 있습니다.

- `Squat Map` 배지를 누르면 관리자 버튼 표시
- 관리자 모달에서 로그인 후 접근
- 전국 5위권 변동 기록만 검수 큐에 등록
- 검수 통과 시 임시 영상 삭제
- 불합격 시 기록과 영상 삭제

## 프로젝트 구조

```text
src/
  components/
    AdminPanel.jsx
    RankingBoard.jsx
    RecordForm.jsx
    RegionMap.jsx
    VideoInput.jsx
  lib/
    admin.js
    depth.js
    pose.js
    records.js
    videoStore.js
  App.jsx
  app.css
```

## 실행 방법

### 요구 사항
- Node.js 20 이상 권장
- npm

### 설치 및 실행

```bash
npm install
npm run dev
```

### 프로덕션 빌드

```bash
npm run build
npm run preview
```

## 트러블슈팅

### 1. 스켈레톤 오버레이가 영상과 어긋나는 문제
문제:
영상 표시 크기를 줄인 뒤 캔버스 오버레이가 실제 영상 영역과 맞지 않아 스켈레톤이 옆으로 늘어지거나 위치가 틀어졌습니다.

원인:
`object-fit: contain`이 적용된 비디오의 실제 표시 영역과 캔버스 크기가 달랐습니다. 비디오 태그 박스 전체를 기준으로 캔버스를 맞추면 레터박스 영역까지 포함되어 좌표가 어긋났습니다.

해결:
- 실제 렌더된 비디오 영역의 크기와 위치를 계산
- 캔버스를 그 영역에만 맞춰 배치
- CSS 강제 `width/height: 100%`를 제거

관련 파일:
- [src/components/VideoInput.jsx](src/components/VideoInput.jsx)
- [src/app.css](src/app.css)

### 2. 관리자 모달이 지도 아래로 깔리는 문제
문제:
Leaflet 지도 위에 관리자 모달을 띄웠는데 모달이 지도보다 아래에 렌더링되는 문제가 있었습니다.

원인:
Leaflet 레이어와 모달의 z-index 우선순위 충돌이었습니다.

해결:
- 모달 백드롭과 패널의 z-index를 충분히 크게 설정
- 모달 레이어를 최상위 오버레이로 고정

관련 파일:
- [src/app.css](src/app.css)

### 3. React `Maximum update depth exceeded` 에러
문제:
관리자 모달을 열면 `Maximum update depth exceeded` 에러가 발생했습니다.

원인:
`AdminPanel`의 `useEffect` 의존성에 렌더마다 새로 만들어지는 배열이 들어가 있었고, effect 안에서 `setState`를 다시 호출하면서 무한 렌더 루프가 생겼습니다.

해결:
- 배열 자체를 의존성으로 쓰지 않음
- 안정적인 문자열 키 기반으로 effect 의존성을 변경

관련 파일:
- [src/components/AdminPanel.jsx](src/components/AdminPanel.jsx)

### 4. 관리자 검수 영상 재생 실패
문제:
관리자 공간에서 검수용 영상이 재생되지 않는 경우가 있었습니다.

원인:
압축된 Blob이 브라우저에서 재생 가능한 코덱/메타데이터를 항상 보장하지 못했습니다.

해결:
- 더 호환성 높은 `webm/vp8` 우선 사용
- 압축 후 실제로 `<video>`에서 메타데이터를 읽을 수 있는지 검증
- 재생 불가 시 압축본 대신 원본 Blob으로 폴백
- 모든 기록이 아니라 `전국 5위권 변동 시`에만 임시 저장하도록 구조 변경

관련 파일:
- [src/lib/videoStore.js](src/lib/videoStore.js)
- [src/App.jsx](src/App.jsx)

### 5. 한글이 깨지는 인코딩 문제
문제:
파일을 PowerShell로 갱신하는 과정에서 한글 문자열이 깨지는 문제가 발생했습니다.

원인:
파일 쓰기 시 인코딩이 일관되지 않았습니다.

해결:
- UTF-8 기준으로 파일 다시 저장
- 일부 문자열은 유니코드 이스케이프 형태로 관리해 콘솔/터미널 인코딩 영향을 줄임

관련 파일:
- [src/App.jsx](src/App.jsx)
- [src/components/AdminPanel.jsx](src/components/AdminPanel.jsx)

## 한계

현재 프로젝트는 백엔드 없이 동작합니다.

- 관리자 인증은 브라우저 기반이라 보안적으로 강하지 않음
- 기록과 검수 큐는 사용자 브라우저 저장소 기준
- 여러 사용자가 같은 랭킹을 공유하는 실서비스 구조는 아님

실서비스로 확장하려면 다음이 필요합니다.

- 서버 기반 인증
- DB 기반 기록 저장
- 서버 업로드 정책과 관리자 검수 API
- 영상 저장 수명 주기 관리

## 앞으로 확장할 수 있는 방향

- Supabase / Firebase / 자체 서버 연동
- 사용자별 계정 시스템
- 랭킹 공유 기능
- 관리자 검수 이력 로그
- 자세 판정 기준 고도화
- 모바일 촬영 가이드 개선