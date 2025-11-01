const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { loadEnv, env } = require('./config/env');
const path = require('path');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const healthRouter = require('./routes/health');
const passport = require('passport');
const session = require('express-session');
const authRouter = require('./routes/auth');
const recommendRouter = require('./routes/recommend');
const chatRouter = require('./routes/chat');
const spotifyRouter = require('./routes/spotify');

// Load environment variables
loadEnv();

const app = express();

// 가장 먼저 매칭되는 테스트 엔드포인트: 서버 코드 버전 확인용
app.get('/__version', (_req, res) => {
  res.json({ ok: true, tag: 'server-version-A', time: Date.now() });
});

// Security & common middlewares
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));
app.use(express.json({ limit: '1mb' }));

// CORS 설정 - 프론트엔드 요청 허용
const corsOptions = {
  origin: function (origin, callback) {
    // 허용할 도메인 목록
    const allowedOrigins = [
      'https://front-lyart-eta.vercel.app',
      'http://localhost:5173',
      'http://localhost:3000'
    ];
    
    // origin이 없는 경우(같은 도메인) 또는 허용 목록에 있는 경우 허용
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn('[CORS] Blocked origin:', origin);
      callback(null, false);
    }
  },
  credentials: true, // 쿠키 및 인증 정보 허용
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  maxAge: 86400 // Preflight 캐시 시간 (24시간)
};

app.use(cors(corsOptions));
app.use(morgan('dev'));
app.use(session({ secret: 'simple_cookie_secret', resave: false, saveUninitialized: false }));
app.use(passport.initialize());
app.use(passport.session());

// API Routes
app.use('/health', healthRouter);
app.use('/auth', authRouter);
app.use('/api/recommend', recommendRouter);
app.use('/api/chat', chatRouter);
app.use('/api/spotify', spotifyRouter);

// 환경변수 확인용 디버그 엔드포인트
app.get('/__env', (_req, res) => {
  res.json({
    CORS_ORIGIN: env.CORS_ORIGIN,
    FRONTEND_URL: env.FRONTEND_URL,
    NODE_ENV: env.NODE_ENV,
    SUPABASE_URL: env.SUPABASE_URL ? '설정됨' : '없음',
    SUPABASE_KEY: env.SUPABASE_SERVICE_ROLE_KEY ? '설정됨' : '없음',
    SPOTIFY_CLIENT_ID: process.env.SPOTIFY_CLIENT_ID ? '설정됨' : '없음',
    SPOTIFY_REDIRECT_URI: process.env.SPOTIFY_REDIRECT_URI || '없음',
  });
});

// 라우팅 디버그용 핑 엔드포인트 (라우터 마운트 전역 확인)
app.get('/auth/ping', (_req, res) => {
  res.json({ ok: true, message: 'index.js level /auth/ping' });
});

// 현재 등록된 모든 라우트를 확인하는 디버그 엔드포인트
function collectRoutes(layer, prefix = '') {
  const routes = [];
  if (layer.route && layer.route.path) {
    const methods = Object.keys(layer.route.methods || {}).map((m) => m.toUpperCase());
    routes.push({ path: prefix + layer.route.path, methods });
  } else if (layer.name === 'router' && layer.handle && layer.regexp) {
    const match = layer.regexp?.toString().match(/\^\\\/(.*?)\\\/?\(\?=\\\/\|\$\)/);
    const base = match && match[1] ? `/${match[1]}` : '';
    const stack = layer.handle.stack || [];
    stack.forEach((l) => routes.push(...collectRoutes(l, prefix + base)));
  } else if (layer.handle && layer.handle.stack) {
    const stack = layer.handle.stack || [];
    stack.forEach((l) => routes.push(...collectRoutes(l, prefix)));
  }
  return routes;
}

app.get('/__routes', (req, res) => {
  try {
    const stack = app._router && app._router.stack ? app._router.stack : [];
    const routes = stack.flatMap((layer) => collectRoutes(layer));
    res.json({ count: routes.length, routes });
  } catch (e) {
    res.status(500).json({ error: String(e && e.message ? e.message : e) });
  }
});

// 404 handler
app.use(notFoundHandler);

// Error handler
app.use(errorHandler);

const port = Number(env.PORT || 4000);
app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`API server listening on http://localhost:${port}`);
});


