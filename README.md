# Squat-Depth Tracker: 브라우저에서 풀 스쿼트 판별

스쿼트 랭킹 지도를 만들 계획이라, 사용자별 스쿼트가 **풀 스쿼트(힙이 무릎보다 낮음)** 인지 자동 판별할 필요가 있었고, 그 **하위 모듈**로 이 트래커를 만들었습니다.
영상에서 포즈를 추적한 뒤, **추적된 키포인트로 깊이를 계산**해 `PASS/FAIL/UNSURE`를 결정합니다.

![2025-10-19132401-ezgif com-loop-count](https://github.com/user-attachments/assets/4bebfef4-bc88-4acf-ac71-c8ebea844238)

  
  **POSE 트래킹**

![2025-10-19134244-ezgif com-loop-count](https://github.com/user-attachments/assets/ddfb5615-e736-4f11-bcfd-64812b2035f4)

  
  **스쿼트 판별**

```
SUMMARY: FAIL
PASS: 0 | FAIL: 1
TH: 0.1 | HOLD: 2
max depth_ratio: 0.09
```
  
여러 사용자의 원본 영상을 서버로 업로드하면 **비용·확장성·개인정보** 문제가 발생합니다. 그래서 **분석은 전부 브라우저(클라이언트)** 에서 수행하고, **요약 결과(깊이·PASS/FAIL 등)** 만 서버로 보내도록 설계했습니다.

---

## 왜 MediaPipe Pose Landmarker (WASM/WebGL) 인가?

| 환경                  | 모델                            | 특징                   | 장점                            | 비고                   |
| ------------------- | ----------------------------- | -------------------- | ----------------------------- | -------------------- |
| **브라우저**            | **MediaPipe Pose Landmarker** | BlazePose 계열 33 키포인트 | **가볍고 빠름**, 셋업 쉬움, 힙/무릎 추적 안정 | YOLO 불필요, 키포인트 즉시 사용 |
| 데스크톱(Electron/네이티브) | YOLOv8n-pose (ONNX/OpenVINO)  | 경량 + 정확도 양호          | GPU 있으면 더 좋음                  | v3 대비 현대화            |

이번 요구사항은 **단일 인원 추적**, **클라이언트 즉시 동작**, **낮은 지연/비용**, **설치 없이 접속**이 핵심이었고 **MediaPipe**가 정확히 부합합니다. WASM + WebGL로 동작하며 **원본 영상이 서버로 가지 않아 프라이버시**에도 유리합니다.

---

## 사용 팁 & 주의 사항

* **이 프로젝트는 “1회” 기준**으로 설계되어 있습니다. **스쿼트 1회만 포함된 영상**을 업로드하세요.

  * 한 영상에 여러 회가 들어 있으면, **단 한 번이라도 풀스쿼트가 나오면 전체가 `PASS`로 표시**될 수 있습니다.
* **촬영 각도**: **완전한 측면(90°)** 은 힙/무릎 가려짐으로 **`UNSURE`가 자주 발생**합니다.
  → **대각선(약 30°~60°)** 방향에서 촬영을 권장합니다. 전신이 프레임에 모두 들어오게 해 주세요.
* 배경과 의상은 **명확한 대비**가 좋고, 조도는 **밝고 균일**하게 유지해주세요. 프레임 드랍이 잦으면 셔터 속도/조명 개선을 권장합니다.

---

## 실행 방법

> Node.js 20+ 권장

```bash
# 1) 클론
git clone https://github.com/asbazq/squat-map.git
cd squat-map/web   # 프런트엔드 디렉터리로 이동

# 2) 의존성 설치
npm install

# 3) 개발 서버 실행
npm run dev

# 4) 브라우저 접속
# 출력된 주소(예: http://localhost:5173) → 스쿼트 "1회" 영상 업로드 → 결과 확인
```

배포:

```bash
npm run build
npm run preview
```

---


# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
