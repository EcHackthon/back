# echack Backend

Node.js + Express 기반 API 서버입니다. 프론트(`front-chat-page/dist`) 정적 파일 서빙과, 추천 결과 교환용 API(`/api/recommend`) 및 헬스체크, 구글 OAuth 라우트를 제공합니다.

## 빠른 시작

```bash
# 1) 의존성 설치
npm install

# 2) 개발 모드 실행 (nodemon)
npm run dev
# 또는 프로덕션 실행
npm start
```

- 기본 포트: `4000` (환경변수 `PORT`로 변경 가능)
- 서버 기동 후 콘솔: `API server listening on http://localhost:4000`

## 환경 변수(.env)
이 디렉토리(`backend`)의 `.env` 파일을 사용합니다. 아래 예시를 `backend/.env`로 저장하세요.

```env
# 실행 모드: development | production
NODE_ENV=development

# 서버 포트
PORT=4000

# CORS 허용 오리진 (프론트 로컬 개발 주소)
CORS_ORIGIN=http://localhost:5173

# (선택) Google OAuth2 설정
# 사용 시 아래 값들을 실제 발급 정보로 설정하세요.
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALLBACK_URL=http://localhost:4000/auth/google/callback
```

주의: Google OAuth가 필요 없다면 위 3개 값은 비워 두셔도 됩니다. 프론트의 로그인 버튼은 제거되어 있지만, 라우트는 남아 있습니다.

## 스크립트
- `npm run dev`: `nodemon`으로 개발 서버 실행
- `npm start`: 프로덕션 모드로 서버 실행

## 제공 엔드포인트

- 건강/디버그
  - `GET /health` → 서버 업타임 리턴
  - `GET /__version` → 간단한 서버 버전/시간 정보
  - `GET /__routes` → 현재 등록된 라우트 목록 리턴(디버그용)

- 추천 API
  - `GET /api/recommend` → 최신 추천 JSON 조회
  - `POST /api/recommend` → 추천 JSON 저장(파이썬/AI 측이 호출)

- 인증(Google OAuth)
  - `GET /auth/google` → Google OAuth 로그인 시작
  - `GET /auth/google/callback` → Google OAuth 콜백 (성공 시 프로필 프린트)

정적 파일 서빙:
- 서버는 `front-chat-page/dist` 를 정적 경로로 서빙합니다.
- SPA 라우팅 특성상 `/health`, `/auth`, `/__routes`, `/api` 를 제외한 모든 경로는 `index.html`로 fallback 됩니다.

## 예시 요청

- 최신 추천 결과 조회
```bash
curl -i http://localhost:4000/api/recommend
```

- 추천 결과 저장(JSON)
```bash
curl -i -X POST http://localhost:4000/api/recommend \
  -H "Content-Type: application/json" \
  -d '{
    "tracks": [
      { "title": "Song A", "artist": "Artist X" },
      { "title": "Song B", "artist": "Artist Y" }
    ],
    "createdAt": 1730356800000
  }'
```

- 헬스 체크
```bash
curl -i http://localhost:4000/health
```

- 라우트 목록 확인(디버그)
```bash
curl -s http://localhost:4000/__routes | jq
```

## Google OAuth 사용 안내(선택)
1) Google Cloud Console에서 OAuth 클라이언트 ID/Secret 발급 후 `.env`에 설정합니다.
2) 승인된 리디렉션 URI에 `http://localhost:4000/auth/google/callback` 추가합니다.
3) 서버 실행 후 `http://localhost:4000/auth/google` 접근으로 로그인 흐름을 테스트할 수 있습니다.

Google 로그인 UI 버튼은 프론트에서 제거되어 있으나, 백엔드 라우트는 유지되어 있습니다. 필요 없으면 `src/index.js`에서 `app.use('/auth', authRouter);` 라인을 주석 처리하여 비활성화할 수 있습니다.

## 프로젝트 구조(요약)
```
backend/
  ├─ src/
  │  ├─ config/env.js           # .env 로더 및 환경 변수 접근자
  │  ├─ middleware/errorHandler.js
  │  ├─ routes/
  │  │  ├─ health.js            # /health
  │  │  ├─ auth.js              # /auth/google, /auth/google/callback
  │  │  └─ recommend.js         # /api/recommend (GET/POST)
  │  └─ index.js                # 앱 엔트리, 라우터 마운트, 정적 서빙
  ├─ package.json
  └─ README.md
```

## 배포 시 참고
- `NODE_ENV=production npm start` 실행 시 에러 응답에 스택이 포함되지 않습니다.
- 프록시/리버스 프록시(Nginx 등) 앞단에서 `CORS_ORIGIN`을 실제 도메인으로 설정하세요.
- 정적 파일 제공 경로(`front-chat-page/dist`)가 배포 환경에 존재해야 합니다.

---
문의/수정 요청은 이 저장소의 이슈로 등록해 주세요.

