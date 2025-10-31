const express = require('express');
const router = express.Router();

// 가장 최근에 수신한 추천 결과를 메모리에 보관
let lastPayload = null;

// 프론트가 최신 추천 결과를 가져갈 때 사용
router.get('/', (_req, res) => {
  const hasData = !!lastPayload;
  // 서버 로그로 조회 요청 기록
  // 예: [recommend] GET /api/recommend -> hasData=true
  console.log(`[recommend] GET /api/recommend -> hasData=${hasData}`);
  res.json({ ok: true, data: lastPayload });
});

// 파이썬(AI)이 추천 결과를 전송하는 엔드포인트
router.post('/', (req, res) => {
  console.log('👉 받은 추천 JSON:', req.body);
  lastPayload = req.body || null;
  res.json({ ok: true });
});

module.exports = router;
