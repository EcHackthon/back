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
app.use(helmet());
app.use(express.json({ limit: '1mb' }));
app.use(
  cors({
    origin: env.CORS_ORIGIN,
    credentials: true,
  })
);
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

// Static assets (serve built frontend)
const distDir = path.resolve(__dirname, '../../front-chat-page/dist');
app.use(express.static(distDir));

// SPA fallback (let React Router handle client-side routes)
app.get(/.*/, (req, res, next) => {
  if (
    req.path.startsWith('/health') ||
    req.path.startsWith('/auth') ||
    req.path.startsWith('/__routes') ||
    req.path.startsWith('/api')
  ) return next();
  res.sendFile(path.join(distDir, 'index.html'));
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


