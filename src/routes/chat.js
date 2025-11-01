const express = require('express');
const axios = require('axios');
const { env } = require('../config/env');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const { loadEnv } = require('../config/env');
loadEnv();

// Supabase 클라이언트 초기화
let supabase = null;
if (env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) {
  try {
    supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
  } catch (error) {
    console.error('[Supabase] 클라이언트 초기화 오류 (chat.js):', error.message);
  }
}

// AI 서버 주소 (main.py가 실행되는 Flask 서버)
const AI_SERVER_URL = env.AI_SERVER_URL;

/**
 * POST /api/chat
 * 프론트엔드에서 사용자 메시지를 받아서 AI 서버로 전달하고 응답을 반환
 */
router.post('/', async (req, res) => {
  try {
    const { message, session_id, user_id, google_id } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({
        ok: false,
        error: 'message 필드가 필요합니다.'
      });
    }

    console.log(`[Chat] 사용자 메시지: ${message}`);
    console.log(`[Chat] AI 서버로 전달: ${AI_SERVER_URL}/api/chat`);
    console.log(`[Chat] 세션 정보: session_id=${session_id || 'default'}, user_id=${user_id || 'none'}, google_id=${google_id || 'none'}`);
    
    // 세션-사용자 매핑 등록 (recommend 엔드포인트에서 사용)
    const currentSessionId = session_id || 'default';
    if (user_id || google_id) {
      console.log(`[Chat] 세션-사용자 매핑 등록 시도: ${currentSessionId} -> ${user_id || google_id}`);
      try {
        await axios.post('http://localhost:4000/api/recommend/session', {
          session_id: currentSessionId,
          user_id,
          google_id
        }, { timeout: 1000 });
        console.log(`[Chat] ✅ 세션-사용자 매핑 등록 성공`);
      } catch (err) {
        // 실패해도 계속 진행
        console.warn('[Chat] 세션-사용자 매핑 등록 실패:', err.message);
      }
    } else {
      console.warn('[Chat] ⚠️ user_id와 google_id가 모두 없어 세션 매핑을 하지 않음');
    }

    // AI 서버(main.py)로 메시지 전달
    const aiResponse = await axios.post(
      `${AI_SERVER_URL}/api/chat`,
      {
        message,
        session_id: session_id || 'default'
      },
      {
        timeout: 30000, // 30초 타임아웃
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    console.log(`[Chat] AI 응답 타입: ${aiResponse.data.type}`);

    // ``` 또는 ''' 로 시작하는 응답 필터링 (코드 블록)
    const messageText = aiResponse.data.message ? aiResponse.data.message.trim() : '';
    if (messageText.startsWith("```") || messageText.startsWith("'''")) {
      console.log(`[Chat] 코드 블록 응답 필터링됨 (시작: ${messageText.substring(0, 3)})`);
      // 필터링된 응답은 표시하지 않고 성공 응답만 반환
      return res.json({
        ok: true,
        type: 'filtered',
        message: '', // 빈 메시지로 반환
        filtered: true
      });
    }

    // AI 응답에 추천 결과가 있고 세션 정보가 있으면 추천 결과를 자동 저장
    if (aiResponse.data.recommendations && aiResponse.data.recommendations.tracks) {
      // 세션 ID를 사용자 식별자로 사용할 수 있다면 저장 시도
      // 하지만 세션 ID만으로는 사용자를 식별할 수 없으므로 프론트엔드에서 처리
      console.log(`[Chat] 추천 결과 포함됨 (${aiResponse.data.recommendations.tracks.length}개 트랙)`);
    }
    
    // AI 서버의 응답을 그대로 프론트엔드로 전달
    res.json({
      ok: true,
      ...aiResponse.data
    });

  } catch (error) {
    console.error('[Chat] 오류 발생:', error.message);
    
    if (error.code === 'ECONNREFUSED') {
      return res.status(503).json({
        ok: false,
        error: 'AI 서버에 연결할 수 없습니다. AI 서버가 실행 중인지 확인해주세요.',
        details: `AI 서버 주소: ${AI_SERVER_URL}`
      });
    }

    if (error.response) {
      // AI 서버에서 에러 응답을 받은 경우
      const errorData = error.response.data;
      console.error('[Chat] AI 서버 에러 응답:', errorData);
      
      return res.status(error.response.status).json({
        ok: false,
        type: errorData.type || 'error',
        message: errorData.message || 'AI 서버 오류',
        error: errorData.message || 'AI 서버 오류',
        details: errorData
      });
    }

    // 기타 오류
    res.status(500).json({
      ok: false,
      type: 'error',
      error: '채팅 처리 중 오류가 발생했습니다.',
      message: error.message,
      details: error.message
    });
  }
});

/**
 * POST /api/chat/reset
 * 채팅 세션 초기화
 */
router.post('/reset', async (req, res) => {
  try {
    const { session_id } = req.body;

    console.log(`[Chat] 세션 초기화 요청: ${session_id || 'default'}`);

    // AI 서버로 초기화 요청 전달
    const aiResponse = await axios.post(
      `${AI_SERVER_URL}/api/chat/reset`,
      {
        session_id: session_id || 'default'
      },
      {
        timeout: 5000,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    res.json({
      ok: true,
      ...aiResponse.data
    });

  } catch (error) {
    console.error('[Chat] 초기화 오류:', error.message);
    
    res.status(500).json({
      ok: false,
      error: '세션 초기화 중 오류가 발생했습니다.',
      details: error.message
    });
  }
});

/**
 * GET /api/chat/status
 * AI 서버 연결 상태 확인
 */
router.get('/status', async (req, res) => {
  try {
    const response = await axios.get(`${AI_SERVER_URL}/api/health`, {
      timeout: 3000
    });

    res.json({
      ok: true,
      ai_server: 'connected',
      ai_server_url: AI_SERVER_URL,
      ai_status: response.data
    });
  } catch (error) {
    res.json({
      ok: false,
      ai_server: 'disconnected',
      ai_server_url: AI_SERVER_URL,
      error: error.message
    });
  }
});

module.exports = router;
