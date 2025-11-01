const express = require('express');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const { createClient } = require('@supabase/supabase-js');
const { env } = require('../config/env');
const { loadEnv } = require('../config/env');
const FRONTEND_URL = process.env.FRONTEND_URL || process.env.CORS_ORIGIN || 'http://localhost:5173';
loadEnv();

const router = express.Router();

// JWT 토큰의 role 확인 함수
function getJwtRole(jwtToken) {
  try {
    const parts = jwtToken.split('.');
    if (parts.length !== 3) return null;
    
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
    return payload.role || null;
  } catch (error) {
    return null;
  }
}

// Supabase 클라이언트 초기화 (Service Role Key 사용 - Admin 권한)
let supabase = null;
if (env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) {
  try {
    // Service Role Key 검증 (JWT 토큰의 role 클레임 확인)
    const keyPreview = env.SUPABASE_SERVICE_ROLE_KEY.substring(0, 50) + '...';
    const jwtRole = getJwtRole(env.SUPABASE_SERVICE_ROLE_KEY);
    
    console.log('[Supabase] 초기화 시도 중...');
    console.log('[Supabase] URL:', env.SUPABASE_URL);
    console.log('[Supabase] Key Preview:', keyPreview);
    console.log('[Supabase] JWT Role:', jwtRole || '파싱 실패');
    
    if (jwtRole !== 'service_role') {
      console.error('[Supabase] ⚠️ 경고: 이 키는 service_role이 아닙니다!');
      console.error('[Supabase] ⚠️ 현재 Role:', jwtRole);
      console.error('[Supabase] ⚠️ Supabase 대시보드 → Settings → API → service_role 키를 사용하세요.');
    }
    
    supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
    
    // Admin 권한 테스트
    supabase.auth.admin.listUsers()
      .then(({ data, error }) => {
        if (error) {
          console.error('[Supabase] Admin 권한 테스트 실패:', error.message);
          console.error('[Supabase] Error Code:', error.code);
          console.error('[Supabase] ⚠️ Service Role Key가 올바르지 않습니다. Supabase 대시보드에서 service_role 키를 확인하세요.');
        } else {
          console.log('[Supabase] 클라이언트 초기화 성공 (Admin 권한 확인됨)');
        }
      })
      .catch(err => {
        console.error('[Supabase] Admin 권한 테스트 중 오류:', err.message);
      });
  } catch (error) {
    console.error('[Supabase] 클라이언트 초기화 오류:', error.message);
  }
} else {
  console.warn('[Supabase] 환경변수가 설정되지 않았습니다.');
  console.warn('[Supabase] SUPABASE_URL:', env.SUPABASE_URL ? '설정됨' : '없음');
  console.warn('[Supabase] SUPABASE_SERVICE_ROLE_KEY:', env.SUPABASE_SERVICE_ROLE_KEY ? '설정됨' : '없음');
}

// 라우터 마운트 확인용 디버그 엔드포인트
router.get('/debug', (_req, res) => {
  res.json({ ok: true, message: 'auth router mounted' });
});

// 패스포트 설정
passport.use(
  new GoogleStrategy(
    {
      clientID: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      callbackURL: env.GOOGLE_CALLBACK_URL,
    },
    function (accessToken, refreshToken, profile, done) {
      // 실제 서비스라면 여기서 DB 저장 후 done(null, user) 할 수 있음
      console.log('구글 프로필', profile);
      return done(null, profile);
    }
  )
);

passport.serializeUser((user, done) => {
  done(null, user);
});
passport.deserializeUser((obj, done) => {
  done(null, obj);
});

// 로그인 라우트
router.get('/google', passport.authenticate('google', {
  scope: ['profile', 'email'],
}));

// 콜백 라우트
router.get(
  '/google/callback',
  passport.authenticate('google', { failureRedirect: `${FRONTEND_URL}?error=google_auth_failed` }),
  function (req, res) {
    // 성공 시: 사용자 정보를 URL 파라미터로 프론트엔드에 전달
    const user = req.user;
    const userInfo = {
      id: user.id,
      name: user.displayName,
      email: user.emails?.[0]?.value,
      picture: user.photos?.[0]?.value
    };
    
    // 사용자 정보를 Base64로 인코딩하여 전달
    const encodedUser = encodeURIComponent(Buffer.from(JSON.stringify(userInfo)).toString('base64'));
    
    console.log('[Google Auth] Success:', userInfo.email);
    
    // 프론트엔드로 리다이렉트 (사용자 정보 포함)
    res.redirect(`${FRONTEND_URL}?google_user=${encodedUser}`);
  }
);

// 구글 사용자 정보 조회 GET 엔드포인트 (세션 기반)
router.get('/google/user', (req, res) => {
  if (req.user) {
    // Passport 세션에서 사용자 정보 반환
    const userInfo = {
      id: req.user.id,
      name: req.user.displayName,
      email: req.user.emails?.[0]?.value,
      picture: req.user.photos?.[0]?.value
    };
    res.json({ success: true, user: userInfo });
  } else {
    res.status(401).json({ 
      success: false, 
      message: 'Not authenticated. Please login first.',
      login_url: '/auth/google'
    });
  }
});

// 구글 로그인 사용자 정보를 받는 POST 엔드포인트
router.post('/google/user', async (req, res) => {
  try {
    const userInfo = req.body;
    
    // 서버 로그에 JSON 형식으로 사용자 정보 출력
    console.log('='.repeat(80));
    console.log('[Google Login] 사용자 정보 수신:');
    console.log(JSON.stringify(userInfo, null, 2));
    console.log('='.repeat(80));
    
    // Supabase가 설정되어 있으면 사용자 정보 저장
    if (supabase) {
      try {
        const googleId = userInfo.id; // 구글 사용자 ID
        const email = userInfo.email;
        const name = userInfo.name;
        const picture = userInfo.picture;
        
        // auth.users 테이블에서 이메일로 기존 사용자 찾기
        const { data: existingUsers, error: findError } = await supabase.auth.admin.listUsers();
        
        if (findError) {
          console.error('[Supabase] 사용자 목록 조회 오류:', findError);
          console.error('[Supabase] Error Code:', findError.code);
          if (findError.code === 'not_admin') {
            console.error('[Supabase] ❌ Admin 권한이 없습니다.');
            console.error('[Supabase] ❌ Service Role Key가 올바른지 확인하세요.');
            console.error('[Supabase] ❌ Supabase 대시보드 → Settings → API → service_role 키를 복사하세요.');
          }
        } else {
          let targetUser = null;
          if (existingUsers && existingUsers.users) {
            // 이메일로 기존 사용자 찾기
            targetUser = existingUsers.users.find(u => u.email === email);
          }
          
          if (targetUser) {
            // 기존 사용자가 있으면 metadata에 google_sub 업데이트
            console.log('[Supabase] 기존 사용자 발견:', targetUser.id);
            const { data: updatedUser, error: updateError } = await supabase.auth.admin.updateUserById(
              targetUser.id,
              {
                user_metadata: {
                  google_sub: googleId,
                  full_name: name,
                  avatar_url: picture
                }
              }
            );
            
            if (updateError) {
              console.error('[Supabase] 사용자 업데이트 오류:', updateError);
            } else {
              console.log('[Supabase] ✅ 기존 사용자 업데이트 성공:');
              console.log('  - User ID:', updatedUser.user.id);
              console.log('  - Email:', updatedUser.user.email);
              
              // public.users 테이블에 저장/업데이트
              const { data: publicUser, error: publicUserError } = await supabase
                .from('users')
                .upsert({
                  id: updatedUser.user.id,
                  email: email,
                  name: name,
                  picture: picture,
                  google_sub: googleId,
                  updated_at: new Date().toISOString()
                }, {
                  onConflict: 'id'
                });
              
              if (publicUserError) {
                console.error('[Supabase] public.users 업데이트 오류:', publicUserError);
              } else {
                console.log('[Supabase] ✅ public.users 테이블에 저장 완료');
              }
            }
          } else {
            // 새 사용자 생성
            console.log('[Supabase] 새 사용자 생성 시도:', email);
            const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
              email: email,
              email_confirm: true, // 이메일 인증된 상태로 생성
              user_metadata: {
                google_sub: googleId,
                full_name: name,
                avatar_url: picture
              }
            });
            
            if (createError) {
              console.error('[Supabase] ❌ 사용자 생성 오류:', createError);
              console.error('[Supabase] Error Code:', createError.code);
              if (createError.code === 'not_admin') {
                console.error('[Supabase] ❌ Admin 권한이 없습니다.');
                console.error('[Supabase] ❌ Service Role Key가 올바른지 확인하세요.');
                console.error('[Supabase] ❌ Supabase 대시보드 → Settings → API → service_role 키를 복사하세요.');
              }
            } else {
              console.log('[Supabase] ✅ 새 사용자 생성 성공:');
              console.log('  - User ID:', newUser.user.id);
              console.log('  - Email:', newUser.user.email);
              
              // public.users 테이블에 저장
              const { data: publicUser, error: publicUserError } = await supabase
                .from('users')
                .insert({
                  id: newUser.user.id,
                  email: email,
                  name: name,
                  picture: picture,
                  google_sub: googleId
                });
              
              if (publicUserError) {
                console.error('[Supabase] public.users 저장 오류:', publicUserError);
              } else {
                console.log('[Supabase] ✅ public.users 테이블에 저장 완료');
              }
            }
          }
        }
      } catch (supabaseError) {
        console.error('[Supabase] 예기치 않은 오류:', supabaseError);
        // Supabase 오류가 있어도 응답은 성공으로 반환 (로그만 남김)
      }
    } else {
      console.warn('[Supabase] Supabase 클라이언트가 설정되지 않았습니다. 환경변수를 확인하세요.');
    }
    
    // 응답 반환
    res.json({ 
      success: true, 
      message: '사용자 정보가 성공적으로 수신되었습니다.',
      received: userInfo
    });
  } catch (error) {
    console.error('[Google Login] 사용자 정보 수신 오류:', error);
    res.status(400).json({ 
      success: false, 
      message: '사용자 정보 수신 중 오류가 발생했습니다.',
      error: error.message 
    });
  }
});

module.exports = router;
