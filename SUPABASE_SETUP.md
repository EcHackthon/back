# Supabase 환경변수 설정 가이드

## 문제 해결: Service Role Key 찾기

현재 `.env` 파일에 있는 `SUPABASE_SERVICE_ROLE_KEY`가 올바른지 확인이 필요합니다.

### 1. Supabase 대시보드 접속
1. https://supabase.com/dashboard 접속
2. 프로젝트 선택

### 2. Service Role Key 확인
1. 왼쪽 사이드바에서 **Settings** (⚙️) 클릭
2. **API** 메뉴 선택
3. **Project API keys** 섹션에서:
   - **`service_role`** 키를 복사합니다 (⚠️ 주의: `anon` 키가 아님!)
   - 이 키는 Admin 권한이 있어서 **절대 공개하면 안 됩니다**

### 3. .env 파일 업데이트

`.env` 파일의 `SUPABASE_SERVICE_ROLE_KEY` 값을 올바른 Service Role Key로 교체하세요:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... (service_role 키)
```

### 4. 확인 방법

Service Role Key는 JWT 토큰의 `role` 클레임에 `service_role`이 포함되어 있어야 합니다.

올바른 Service Role Key 예시:
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlvdXItcHJvamVjdCIsInJvbGUiOiJzZXJ2aWNlX3JvbGUiLCJpYXQiOjE2NDUxOTIwMDAsImV4cCI6MTk2MDc2ODAwMH0.xxx
```

⚠️ **보안 주의사항**:
- Service Role Key는 **절대** 프론트엔드나 클라이언트 코드에 노출되면 안 됩니다
- 오직 서버 사이드에서만 사용해야 합니다
- GitHub에 커밋하지 않도록 `.env` 파일을 `.gitignore`에 추가하세요

### 5. 서버 재시작

환경변수 변경 후 서버를 재시작하세요:

```bash
npm run dev
```

### 6. 로그 확인

서버 시작 시 다음 로그가 나와야 합니다:
```
[Supabase] 클라이언트 초기화 성공
```

만약 여전히 경고가 나온다면:
- `.env` 파일이 올바른 위치에 있는지 확인
- 환경변수 이름이 정확한지 확인 (`SUPABASE_SERVICE_ROLE_KEY`)
- 서버를 완전히 재시작했는지 확인

