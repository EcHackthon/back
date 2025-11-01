const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const { env } = require('../config/env');
const { loadEnv } = require('../config/env');
loadEnv();

const router = express.Router();

// Supabase 클라이언트 초기화 (Service Role Key 사용 - Admin 권한)
let supabase = null;
if (env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) {
  try {
    supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
    console.log('[Supabase] 클라이언트 초기화 성공 (recommend.js)');
  } catch (error) {
    console.error('[Supabase] 클라이언트 초기화 오류 (recommend.js):', error.message);
  }
}

// 가장 최근에 수신한 추천 결과를 메모리에 보관
let lastPayload = null;

// 세션 ID와 사용자 매핑 (최근 활성 세션)
const sessionUserMap = new Map();

// 프론트가 최신 추천 결과를 가져갈 때 사용
router.get('/', (_req, res) => {
  const hasData = !!lastPayload;
  console.log(`[recommend] GET /api/recommend -> hasData=${hasData}`);
  res.json({ ok: true, data: lastPayload });
});

// 파이썬(AI)이 추천 결과를 전송하는 엔드포인트
router.post('/', async (req, res) => {
  console.log('👉 받은 추천 JSON:', req.body);
  lastPayload = req.body || null;
  
  // 추천 결과를 DB에 자동 저장
  console.log(`[Recommend] Checking DB save: has tracks=${!!req.body?.tracks}, is array=${Array.isArray(req.body?.tracks)}, has supabase=${!!supabase}`);
  if (req.body && req.body.tracks && Array.isArray(req.body.tracks) && req.body.tracks.length > 0 && supabase) {
    console.log(`[Recommend] ✅ Starting DB save for ${req.body.tracks.length} tracks`);
    try {
      // 세션 ID로 사용자 찾기 (body 또는 헤더에서)
      const sessionId = req.body.session_id || req.headers['x-session-id'] || 'default';
      console.log(`[Recommend] session_id: ${sessionId}, sessionUserMap size: ${sessionUserMap.size}`);
      const userInfo = sessionUserMap.get(sessionId);
      console.log(`[Recommend] userInfo from session:`, userInfo);
      
      let user_id = null;
      let google_id = null;
      
      // 세션 매핑에서 사용자 정보 가져오기
      if (userInfo) {
        user_id = userInfo.user_id;
        google_id = userInfo.google_id;
        console.log(`[Recommend] Found user from session: user_id=${user_id}, google_id=${google_id}`);
      }
      
      // 헤더나 body에서 직접 사용자 정보 확인 (우선순위)
      const directUserInfo = req.body.user_info || req.headers['x-user-id'] || req.headers['x-google-id'];
      if (directUserInfo) {
        if (typeof directUserInfo === 'string') {
          if (directUserInfo.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
            user_id = directUserInfo;
          } else {
            google_id = directUserInfo;
          }
        } else if (directUserInfo.user_id) {
          user_id = directUserInfo.user_id;
        } else if (directUserInfo.google_id) {
          google_id = directUserInfo.google_id;
        }
      }
      
      // google_id가 있으면 user_id로 변환
      if (!user_id && google_id) {
        const { data: user } = await supabase
          .from('users')
          .select('id')
          .eq('google_sub', google_id)
          .single();
        
        if (user) {
          user_id = user.id;
        }
      }
      
      // user_id가 있으면 DB에 저장
      console.log(`[Recommend] Final check: user_id=${user_id}, google_id=${google_id}`);
      if (user_id) {
        console.log(`[Recommend] ✅ Saving to DB with user_id: ${user_id}`);
        const { data: publicUser } = await supabase
          .from('users')
          .select('google_sub')
          .eq('id', user_id)
          .single();
        
        const googleSub = publicUser ? publicUser.google_sub : null;
        
        const tracksToInsert = req.body.tracks.map(track => ({
          user_id: user_id,
          google_sub: googleSub,
          song_title: track.name || track.title || '',
          artist: Array.isArray(track.artists) 
            ? track.artists.map(a => typeof a === 'string' ? a : a.name).join(', ')
            : (track.artist || ''),
          url: track.url || track.uri || track.external_urls?.spotify || '',
          album_image: track.album_image || track.album?.image || track.image || ''
        }));
        
        const { error: insertError } = await supabase
          .from('recommendations')
          .insert(tracksToInsert);
        
        if (!insertError) {
          console.log(`[Supabase] ✅ AI 서버에서 받은 추천곡 ${tracksToInsert.length}개 자동 저장 완료 (user_id: ${user_id})`);
        } else {
          console.error('[Supabase] 추천곡 자동 저장 오류:', insertError);
          console.error('[Supabase] 오류 상세:', JSON.stringify(insertError, null, 2));
        }
      } else {
        console.log(`[Recommend] 사용자 정보가 없어 추천곡 저장 스킵 (session_id: ${sessionId})`);
      }
    } catch (error) {
      console.error('[Recommend] 자동 저장 중 오류:', error);
      // 오류가 있어도 메인 응답은 정상 반환
    }
  }
  
  res.json({ ok: true });
});

// 세션-사용자 매핑 등록 (프론트엔드나 chat 엔드포인트에서 호출)
router.post('/session', (req, res) => {
  const { session_id, user_id, google_id } = req.body;
  
  if (session_id && (user_id || google_id)) {
    sessionUserMap.set(session_id, { user_id, google_id });
    console.log(`[Recommend] 세션-사용자 매핑 등록: ${session_id} -> ${user_id || google_id}`);
    res.json({ success: true, message: '세션-사용자 매핑이 등록되었습니다.' });
  } else {
    res.status(400).json({ success: false, message: 'session_id와 user_id 또는 google_id가 필요합니다.' });
  }
});

// 구글 ID로 user_id 조회 헬퍼 엔드포인트
router.get('/user-id/:googleId', async (req, res) => {
  try {
    const { googleId } = req.params;
    
    if (!supabase) {
      return res.status(500).json({ 
        success: false, 
        message: 'Supabase 클라이언트가 설정되지 않았습니다.' 
      });
    }
    
    const { data: user, error } = await supabase
      .from('users')
      .select('id')
      .eq('google_sub', googleId)
      .single();
    
    if (error || !user) {
      return res.status(404).json({ 
        success: false, 
        message: '사용자를 찾을 수 없습니다.' 
      });
    }
    
    res.json({ 
      success: true, 
      user_id: user.id 
    });
  } catch (error) {
    console.error('[Recommend] user_id 조회 오류:', error);
    res.status(500).json({ 
      success: false, 
      message: '서버 오류가 발생했습니다.',
      error: error.message 
    });
  }
});

// 사용자별 추천곡 저장 엔드포인트
router.post('/save', async (req, res) => {
  try {
    let { user_id, google_id, tracks } = req.body;
    
    // google_id가 제공되면 user_id로 변환
    if (!user_id && google_id) {
      if (!supabase) {
        return res.status(500).json({ 
          success: false, 
          message: 'Supabase 클라이언트가 설정되지 않았습니다.' 
        });
      }
      
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('google_sub', google_id)
        .single();
      
      if (userError || !user) {
        return res.status(404).json({ 
          success: false, 
          message: '사용자를 찾을 수 없습니다. 먼저 구글 로그인을 해주세요.' 
        });
      }
      
      user_id = user.id;
    }
    
    if (!user_id) {
      return res.status(400).json({ 
        success: false, 
        message: 'user_id 또는 google_id가 필요합니다.' 
      });
    }
    
    if (!tracks || !Array.isArray(tracks) || tracks.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'tracks 배열이 필요합니다.' 
      });
    }
    
    if (!supabase) {
      return res.status(500).json({ 
        success: false, 
        message: 'Supabase 클라이언트가 설정되지 않았습니다.' 
      });
    }
    
    // public.users 테이블에서 google_sub 가져오기
    const { data: publicUser, error: userError } = await supabase
      .from('users')
      .select('google_sub')
      .eq('id', user_id)
      .single();
    
    if (userError && userError.code !== 'PGRST116') { // PGRST116 = not found
      console.error('[Supabase] 사용자 조회 오류:', userError);
    }
    
    const googleSub = publicUser ? publicUser.google_sub : null;
    
    // 각 트랙을 recommendations 테이블에 저장
    const tracksToInsert = tracks.map(track => ({
      user_id: user_id,
      google_sub: googleSub,
      song_title: track.name || track.title || '',
      artist: Array.isArray(track.artists) 
        ? track.artists.map(a => typeof a === 'string' ? a : a.name).join(', ')
        : (track.artist || ''),
      url: track.url || track.uri || track.external_urls?.spotify || '',
      album_image: track.album_image || track.album?.image || track.image || ''
    }));
    
    const { data: insertedData, error: insertError } = await supabase
      .from('recommendations')
      .insert(tracksToInsert)
      .select();
    
    if (insertError) {
      console.error('[Supabase] 추천곡 저장 오류:', insertError);
      return res.status(500).json({ 
        success: false, 
        message: '추천곡 저장 중 오류가 발생했습니다.',
        error: insertError.message 
      });
    }
    
    console.log(`[Supabase] ✅ ${insertedData.length}개 추천곡 저장 성공 (user_id: ${user_id})`);
    
    res.json({ 
      success: true, 
      message: `${insertedData.length}개의 추천곡이 성공적으로 저장되었습니다.`,
      count: insertedData.length,
      data: insertedData
    });
    
  } catch (error) {
    console.error('[Recommend] 서버 오류:', error);
    res.status(500).json({ 
      success: false, 
      message: '서버 오류가 발생했습니다.',
      error: error.message 
    });
  }
});

module.exports = router;
