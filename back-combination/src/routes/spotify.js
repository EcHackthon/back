const express = require('express');
const router = express.Router();
const axios = require('axios');

const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const SPOTIFY_REDIRECT_URI = process.env.SPOTIFY_REDIRECT_URI || 'http://localhost:4000/api/spotify/callback';

// 임시로 토큰을 메모리에 저장 (실제로는 DB나 세션 사용 권장)
let tokenStore = {};

/**
 * GET /api/spotify/login
 * Spotify OAuth 로그인 페이지로 리다이렉트
 */
router.get('/login', (req, res) => {
  const scopes = [
    'user-read-private',
    'user-read-email',
    'streaming',
    'user-read-playback-state',
    'user-modify-playback-state',
    'user-library-read',
    'playlist-read-private'
  ].join(' ');

  const authUrl = 'https://accounts.spotify.com/authorize?' + 
    new URLSearchParams({
      response_type: 'code',
      client_id: SPOTIFY_CLIENT_ID,
      scope: scopes,
      redirect_uri: SPOTIFY_REDIRECT_URI,
      show_dialog: true
    });

  res.redirect(authUrl);
});

/**
 * GET /api/spotify/callback
 * Spotify OAuth 콜백 처리
 */
router.get('/callback', async (req, res) => {
  const { code, error } = req.query;

  if (error) {
    console.error('Spotify OAuth error:', error);
    return res.redirect('http://localhost:5173/chat?spotify_error=' + error);
  }

  if (!code) {
    return res.redirect('http://localhost:5173/chat?spotify_error=no_code');
  }

  try {
    // Authorization code를 access token으로 교환
    const tokenResponse = await axios.post(
      'https://accounts.spotify.com/api/token',
      new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: SPOTIFY_REDIRECT_URI,
        client_id: SPOTIFY_CLIENT_ID,
        client_secret: SPOTIFY_CLIENT_SECRET
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    const { access_token, refresh_token, expires_in } = tokenResponse.data;

    // 토큰 저장 (실제로는 세션이나 DB 사용)
    tokenStore = {
      access_token,
      refresh_token,
      expires_at: Date.now() + (expires_in * 1000)
    };

    console.log('[Spotify] Access token obtained successfully');

    // 프론트엔드로 리다이렉트 (토큰을 URL에 포함)
    res.redirect(`http://localhost:5173/chat?spotify_token=${access_token}`);

  } catch (error) {
    console.error('[Spotify] Token exchange failed:', error.response?.data || error.message);
    res.redirect('http://localhost:5173/chat?spotify_error=token_failed');
  }
});

/**
 * GET /api/spotify/token
 * 현재 저장된 access token 반환 또는 갱신
 */
router.get('/token', async (req, res) => {
  try {
    // 토큰이 없으면 에러
    if (!tokenStore.access_token) {
      return res.status(401).json({ error: 'No token available' });
    }

    // 토큰이 만료되었으면 갱신
    if (Date.now() >= tokenStore.expires_at) {
      console.log('[Spotify] Token expired, refreshing...');
      
      const refreshResponse = await axios.post(
        'https://accounts.spotify.com/api/token',
        new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: tokenStore.refresh_token,
          client_id: SPOTIFY_CLIENT_ID,
          client_secret: SPOTIFY_CLIENT_SECRET
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      const { access_token, expires_in } = refreshResponse.data;
      
      tokenStore.access_token = access_token;
      tokenStore.expires_at = Date.now() + (expires_in * 1000);
      
      console.log('[Spotify] Token refreshed successfully');
    }

    res.json({ 
      access_token: tokenStore.access_token,
      expires_at: tokenStore.expires_at
    });

  } catch (error) {
    console.error('[Spotify] Token retrieval failed:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to get token' });
  }
});

/**
 * POST /api/spotify/play
 * Spotify에서 트랙 재생
 */
router.post('/play', async (req, res) => {
  const { access_token, device_id, track_uri } = req.body;

  if (!access_token || !device_id || !track_uri) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }

  try {
    await axios.put(
      `https://api.spotify.com/v1/me/player/play?device_id=${device_id}`,
      {
        uris: [track_uri]
      },
      {
        headers: {
          'Authorization': `Bearer ${access_token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    res.json({ success: true });

  } catch (error) {
    console.error('[Spotify] Play failed:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({ 
      error: 'Failed to play track',
      details: error.response?.data 
    });
  }
});

module.exports = router;
