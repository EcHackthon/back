const express = require('express');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const { env } = require('../config/env');
const { loadEnv } = require('../config/env');
loadEnv();

const router = express.Router();

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
  passport.authenticate('google', { failureRedirect: '/' }),
  function (req, res) {
    // 성공 시: 사용자 정보 임시 확인용. 실제 서비스라면 토큰 발급 등 처리
    res.send('<h1>구글 인증 성공</h1><pre>' + JSON.stringify(req.user, null, 2) + '</pre>');
  }
);

module.exports = router;
