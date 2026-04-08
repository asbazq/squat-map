# Squat Map

스쿼트 영상을 브라우저에서 분석해 풀스쿼트 여부를 판정하고, 통과한 기록을 지역별 지도와 랭킹에 반영하는 프로젝트입니다.

현재 저장소는 다음 두 애플리케이션을 함께 포함합니다.

- 프론트엔드: `React 19 + Vite`
- 백엔드: `Spring Boot 3.5 + Java 17 + MySQL`

## 주요 기능

- 영상 업로드 후 브라우저에서 스쿼트 자세 분석
- MediaPipe Pose Landmarker 기반 스켈레톤 오버레이
- `PASS / FAIL / MIXED / UNSURE` 판정 및 반복 수 요약
- `PASS` 결과일 때만 기록 저장 허용
- 브라우저 위치 정보를 이용한 지역 자동 선택
- 대한민국 시도 단위 지도 시각화 및 지역별 리더 표시
- 전국/지역 랭킹 집계
- 전국 Top 5 변동 기록에 대한 관리자 검수 플로우
- 검수용 영상 S3 업로드 및 관리자 재생

## 구조

```text
squat-map/
├─ src/                      # React 프론트엔드
│  ├─ components/            # 화면 컴포넌트
│  ├─ lib/                   # 자세 분석, 기록 계산, 브라우저 저장소 유틸
│  ├─ config.js              # 분석 임계값
│  └─ App.jsx                # 메인 대시보드
├─ public/                   # 지도 GeoJSON 등 정적 자산
├─ backend/                  # Spring Boot API 서버
│  ├─ src/main/java/...      # 컨트롤러, 서비스, 엔티티
│  ├─ src/main/resources/    # application.yml
│  └─ .env.example           # 서버 환경 변수 예시
└─ deploy/                   # nginx / systemd 배포 예시
```

## 동작 방식

1. 사용자가 스쿼트 영상을 업로드합니다.
2. 프론트엔드가 MediaPipe를 이용해 브라우저에서 포즈를 추적합니다.
3. 깊이 비율(`depth_ratio`)과 반복 안정성을 기준으로 결과를 요약합니다.
4. 결과가 `PASS`면 기록 입력 폼이 열리고, 위치 정보를 바탕으로 지역을 제안합니다.
5. 기록은 백엔드 `POST /api/records`로 저장되고 지도/랭킹에 즉시 반영됩니다.
6. 새 기록이 전국 Top 5에 진입하면 검수 대기열이 생성되고, 검수용 영상이 S3에 업로드됩니다.
7. 관리자는 로그인 후 presigned URL로 대기열 영상을 확인하고 승인 또는 삭제를 수행할 수 있습니다.

## 기술 스택

### Frontend

- React 19
- Vite 7
- Leaflet / React Leaflet
- MediaPipe Pose Landmarker

### Backend

- Spring Boot 3.5
- Java 17
- Spring Data JPA
- MySQL

### Client-side Storage

- `sessionStorage`: 관리자 세션 임시 보관
- `localStorage`: 레거시 데이터 마이그레이션 보조

## 로컬 실행

### 1. 프론트엔드

요구 사항:

- Node.js 20 이상 권장
- npm

실행:

```bash
npm install
npm run dev
```

기본 개발 서버 주소는 `http://localhost:5173`입니다.

### 2. 백엔드

요구 사항:

- Java 17
- MySQL 8.x

환경 변수 예시:

```env
SPRING_DATASOURCE_URL=
SPRING_DATASOURCE_USERNAME=
SPRING_DATASOURCE_PASSWORD=
PORT=8080
CORS_ALLOWED_ORIGINS=
ADMIN_BOOTSTRAP_USERNAME=
ADMIN_BOOTSTRAP_PASSWORD=
S3_ENABLED=true
S3_REGION=ap-northeast-2
S3_BUCKET=
S3_ACCESS_KEY=
S3_SECRET_KEY=
S3_ENDPOINT=
S3_REVIEW_VIDEO_PREFIX=review-videos
S3_PRESIGNED_URL_MINUTES=30
```

실행:

```bash
cd backend
./gradlew bootRun
```


### 3. 프론트엔드와 백엔드 함께 사용

- 프론트엔드: `5173`
- 백엔드: `8080`
- 프론트는 상대 경로 `/api/*`를 사용하므로, 개발 시 프록시 또는 같은 도메인 구성 여부를 확인해야 합니다.

현재 프론트 코드 기준 주요 API는 다음과 같습니다.

- `GET /api/records`
- `POST /api/records`
- `POST /api/records/{recordId}/review-video`
- `DELETE /api/records/{recordId}`
- `POST /api/admin/auth/login`
- `GET /api/admin/review-queue`
- `POST /api/admin/review-queue`
- `POST /api/admin/review-queue/{recordId}/approve`
- `POST /api/admin/review-queue/{recordId}/reject`
- `DELETE /api/admin/review-queue/{recordId}`
- `GET /api/rankings`
- `GET /api/health`

## 빌드

프론트엔드:

```bash
npm run build
npm run preview
```

백엔드 테스트:

```bash
cd backend
./gradlew test
```


## 관리자 인증 모델

현재 관리자 기능은 초기 통합용 구조입니다.

- 로그인 API: `POST /api/admin/auth/login`
- 삭제/검수 API: `X-Admin-Username`, `X-Admin-Password` 헤더 사용
- 프론트는 로그인 성공 시 계정을 `sessionStorage`에 저장

## 배포 참고

배포 예시는 아래 파일에 포함되어 있습니다.

- [`backend/.env.example`](/E:/Project/squat-map/backend/.env.example)
- [`backend/README.md`](/E:/Project/squat-map/backend/README.md)
- [`deploy/nginx/squat-map.conf`](/E:/Project/squat-map/deploy/nginx/squat-map.conf)
- [`deploy/nginx/squat-map-ssl.conf`](/E:/Project/squat-map/deploy/nginx/squat-map-ssl.conf)
- [`deploy/routinehub.service.example`](/E:/Project/squat-map/deploy/routinehub.service.example)

권장 운영 구조:

- 정적 프론트엔드: Nginx
- API 서버: Spring Boot (`127.0.0.1:8080`)
- DB: MySQL / RDS
- 검수 영상 저장소: S3

## 현재 한계

- 영상 분석은 클라이언트 성능과 브라우저 호환성에 영향을 받습니다.
- 관리자 인증 방식은 프로덕션 보안 기준으로 충분하지 않습니다.
- 프론트에 레거시 `localStorage` 마이그레이션 코드가 남아 있어 완전한 서버 일원화 전환은 아직 진행 중입니다.

## 문서

- 프론트/전체 개요: 이 문서
- 백엔드 상세: [`backend/README.md`](/E:/Project/squat-map/backend/README.md)



