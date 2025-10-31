const path = require('path');
let loaded = false;

function loadEnv() {
  if (loaded) return;
  // Lazy-load dotenv to avoid requiring it in production if not installed
  // eslint-disable-next-line global-require
  require('dotenv').config({ path: path.resolve(process.cwd(), '.env') });
  loaded = true;
}

const env = new Proxy(
  {},
  {
    get: (_target, prop) => {
      const key = String(prop);
      return process.env[key];
    },
  }
);

module.exports = {
  loadEnv,
  env: {
    get NODE_ENV() {
      return process.env.NODE_ENV || 'development';
    },
    get PORT() {
      return process.env.PORT || '4000';
    },
    get CORS_ORIGIN() {
      return process.env.CORS_ORIGIN || 'http://localhost:5173';
    },
    get GOOGLE_CLIENT_ID() {
      return process.env.GOOGLE_CLIENT_ID;
    },
    get GOOGLE_CLIENT_SECRET() {
      return process.env.GOOGLE_CLIENT_SECRET;
    },
    get GOOGLE_CALLBACK_URL() {
      return process.env.GOOGLE_CALLBACK_URL;
    },
  },
};


