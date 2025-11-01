# Supabase에서 사용자 정보 확인 방법

## 1. auth.users 테이블 확인

Supabase 대시보드에서 사용자를 확인하는 방법:

1. **Supabase 대시보드 접속**: https://supabase.com/dashboard
2. 프로젝트 선택
3. 왼쪽 사이드바 → **Authentication** (사용자 아이콘) 클릭
4. **Users** 탭 선택
5. 여기서 모든 사용자 목록을 볼 수 있습니다

### 확인할 내용:
- **Email**: 사용자 이메일
- **User UID**: UUID 형식의 사용자 ID (이게 `auth.users.id`)
- **User Metadata**: 여기에 `google_sub`가 저장되어 있어야 합니다

### User Metadata 확인 방법:
1. 사용자 행을 클릭하면 상세 정보가 나옵니다
2. **User Metadata** 섹션에서 다음을 확인:
   ```json
   {
     "google_sub": "123456789...",
     "full_name": "사용자 이름",
     "avatar_url": "프로필 이미지 URL"
   }
   ```

## 2. recommendations 테이블 확인

현재 코드는 `auth.users` 테이블에만 저장하고 있습니다.
`recommendations` 테이블에 `google_sub`를 저장하려면 별도의 로직이 필요합니다.

1. **Supabase 대시보드** → **Table Editor**
2. **recommendations** 테이블 선택
3. 여기서 `google_sub` 필드에 값이 있는지 확인

## 3. SQL로 직접 확인

SQL Editor에서 다음 쿼리를 실행:

```sql
-- auth.users 테이블에서 사용자 확인
SELECT 
  id,
  email,
  raw_user_meta_data->>'google_sub' as google_sub,
  raw_user_meta_data->>'full_name' as full_name,
  created_at
FROM auth.users
ORDER BY created_at DESC
LIMIT 10;

-- recommendations 테이블에서 google_sub 확인
SELECT 
  id,
  user_id,
  google_sub,
  song_title,
  artist,
  created_at
FROM public.recommendations
ORDER BY created_at DESC
LIMIT 10;
```

## 4. 디버깅

서버 로그에서 다음을 확인:
- `[Supabase] ✅ 기존 사용자 업데이트 성공: <user_id>`
- `[Supabase] ✅ 새 사용자 생성 성공: <user_id>`

이 로그가 나오면 사용자는 정상적으로 생성/업데이트되었습니다.
대시보드에서 확인하려면 위의 방법을 사용하세요.

