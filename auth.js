'use strict';
const crypto = require('crypto');
const { promisify } = require('util');
const { Pool } = require('pg');
const scrypt = promisify(crypto.scrypt);

const COOKIE = 'slime_session';
const SESSION_DAYS = 30;
const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 3,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000
    })
  : null;

let schemaPromise = null;
const attempts = new Map();

async function ensureSchema() {
  if (!pool) throw new Error('AUTH_DATABASE_NOT_CONFIGURED');
  if (!schemaPromise) {
    schemaPromise = (async () => {
      await pool.query('CREATE TABLE IF NOT EXISTS slime_accounts (id UUID PRIMARY KEY, email VARCHAR(254) NOT NULL UNIQUE, password_salt CHAR(32) NOT NULL, password_hash CHAR(128) NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())');
      await pool.query('CREATE TABLE IF NOT EXISTS slime_account_sessions (token_hash CHAR(64) PRIMARY KEY, account_id UUID NOT NULL REFERENCES slime_accounts(id) ON DELETE CASCADE, expires_at TIMESTAMPTZ NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())');
      await pool.query('CREATE INDEX IF NOT EXISTS slime_account_sessions_account_idx ON slime_account_sessions(account_id)');
    })().catch((error) => {
      schemaPromise = null;
      throw error;
    });
  }
  return schemaPromise;
}

function send(res, status, data, extraHeaders = {}) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    ...extraHeaders
  });
  res.end(JSON.stringify(data));
}

function cookieValue(req) {
  const cookie = String(req.headers.cookie || '');
  for (const part of cookie.split(';')) {
    const index = part.indexOf('=');
    if (index < 0) continue;
    if (part.slice(0, index).trim() === COOKIE) {
      try { return decodeURIComponent(part.slice(index + 1).trim()); }
      catch { return null; }
    }
  }
  return null;
}

function cookieHeader(token, maxAge = SESSION_DAYS * 24 * 60 * 60, req = null) {
  const forwardedProto = String(req && req.headers && req.headers['x-forwarded-proto'] || '').split(',')[0].trim().toLowerCase();
  const secure = forwardedProto === 'https' || !!process.env.RENDER || process.env.NODE_ENV === 'production' ? '; Secure' : '';
  const expires = maxAge > 0 ? '; Expires=' + new Date(Date.now() + maxAge * 1000).toUTCString() : '; Expires=Thu, 01 Jan 1970 00:00:00 GMT';
  return COOKIE + '=' + encodeURIComponent(token) + '; HttpOnly; Path=/; SameSite=Lax; Max-Age=' + maxAge + expires + secure;
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  try {
    return new URL(origin).host.toLowerCase() === String(req.headers.host || '').toLowerCase();
  } catch {
    return false;
  }
}

async function readJson(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 8192) {
      const error = new Error('REQUEST_TOO_LARGE');
      error.status = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    const error = new Error('INVALID_JSON');
    error.status = 400;
    throw error;
  }
}

function validEmail(input) {
  const email = String(input || '').trim().toLowerCase();
  if (email.length > 254 || email.length < 6) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return null;
  return email;
}

function rateLimit(req, action) {
  const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown').split(',')[0].trim();
  const key = action + ':' + ip;
  const now = Date.now();
  const item = attempts.get(key);
  if (!item || now - item.startedAt > 15 * 60 * 1000) {
    attempts.set(key, { startedAt: now, count: 1 });
    return true;
  }
  if (item.count >= 12) return false;
  item.count += 1;
  return true;
}

async function makePasswordHash(password, saltHex) {
  const derived = await scrypt(password, Buffer.from(saltHex, 'hex'), 64, {
    N: 16384,
    r: 8,
    p: 1,
    maxmem: 64 * 1024 * 1024
  });
  return derived.toString('hex');
}

function passwordsMatch(savedHex, candidateHex) {
  if (!savedHex || !candidateHex || savedHex.length !== candidateHex.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(savedHex, 'hex'), Buffer.from(candidateHex, 'hex'));
  } catch {
    return false;
  }
}

async function createSession(accountId, res, req) {
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await pool.query('DELETE FROM slime_account_sessions WHERE expires_at <= NOW()');
  await pool.query(
    'INSERT INTO slime_account_sessions(token_hash, account_id, expires_at) VALUES($1, $2, $3)',
    [tokenHash, accountId, expiresAt]
  );
  return cookieHeader(token, SESSION_DAYS * 24 * 60 * 60, req);
}

async function currentAccount(req) {
  const token = cookieValue(req);
  if (!token || token.length !== 64) return null;
  const result = await pool.query(
    'SELECT a.id, a.email FROM slime_account_sessions s JOIN slime_accounts a ON a.id = s.account_id WHERE s.token_hash = $1 AND s.expires_at > NOW() LIMIT 1',
    [hashToken(token)]
  );
  return result.rows[0] || null;
}

async function handleAuthRequest(req, res, pathname) {
  if (!pathname.startsWith('/api/auth/')) return false;
  if (!sameOrigin(req)) {
    send(res, 403, { error: 'Origem da solicitação não permitida.' });
    return true;
  }

  try {
    await ensureSchema();

    if (pathname === '/api/auth/me' && req.method === 'GET') {
      const account = await currentAccount(req);
      send(res, 200, account ? { authenticated: true, email: account.email } : { authenticated: false });
      return true;
    }

    if (pathname === '/api/auth/register' && req.method === 'POST') {
      if (!rateLimit(req, 'register')) {
        send(res, 429, { error: 'Muitas tentativas. Tente novamente mais tarde.' });
        return true;
      }
      if (!String(req.headers['content-type'] || '').includes('application/json')) {
        send(res, 415, { error: 'Envie os dados em formato JSON.' });
        return true;
      }
      const body = await readJson(req);
      const email = validEmail(body.email);
      const password = typeof body.password === 'string' ? body.password : '';
      if (!email) {
        send(res, 400, { error: 'Digite um endereço de email válido.' });
        return true;
      }
      if (password.length < 6 || password.length > 128) {
        send(res, 400, { error: 'A senha precisa ter entre 6 e 128 caracteres.' });
        return true;
      }
      const id = crypto.randomUUID();
      const salt = crypto.randomBytes(16).toString('hex');
      const passwordHash = await makePasswordHash(password, salt);
      try {
        await pool.query('INSERT INTO slime_accounts(id, email, password_salt, password_hash) VALUES($1, $2, $3, $4)', [id, email, salt, passwordHash]);
      } catch (error) {
        if (error.code === '23505') {
          send(res, 409, { error: 'Já existe uma conta com esse email.' });
          return true;
        }
        throw error;
      }
      const cookie = await createSession(id, res, req);
      send(res, 201, { authenticated: true, email }, { 'Set-Cookie': cookie });
      return true;
    }

    if (pathname === '/api/auth/login' && req.method === 'POST') {
      if (!rateLimit(req, 'login')) {
        send(res, 429, { error: 'Muitas tentativas. Tente novamente mais tarde.' });
        return true;
      }
      if (!String(req.headers['content-type'] || '').includes('application/json')) {
        send(res, 415, { error: 'Envie os dados em formato JSON.' });
        return true;
      }
      const body = await readJson(req);
      const email = validEmail(body.email);
      const password = typeof body.password === 'string' ? body.password : '';
      if (!email || !password || password.length > 128) {
        send(res, 400, { error: 'Email ou senha inválidos.' });
        return true;
      }
      const result = await pool.query('SELECT id, email, password_salt, password_hash FROM slime_accounts WHERE email = $1 LIMIT 1', [email]);
      const account = result.rows[0];
      if (!account) {
        send(res, 401, { error: 'Email ou senha incorretos.' });
        return true;
      }
      const candidate = await makePasswordHash(password, account.password_salt);
      if (!passwordsMatch(account.password_hash, candidate)) {
        send(res, 401, { error: 'Email ou senha incorretos.' });
        return true;
      }
      const cookie = await createSession(account.id, res, req);
      send(res, 200, { authenticated: true, email: account.email }, { 'Set-Cookie': cookie });
      return true;
    }

    if (pathname === '/api/auth/logout' && req.method === 'POST') {
      const token = cookieValue(req);
      if (token && token.length === 64) {
        await pool.query('DELETE FROM slime_account_sessions WHERE token_hash = $1', [hashToken(token)]);
      }
      send(res, 200, { ok: true }, { 'Set-Cookie': cookieHeader('', 0, req) });
      return true;
    }

    if (pathname === '/api/auth/account' && req.method === 'DELETE') {
      if (!String(req.headers['content-type'] || '').includes('application/json')) {
        send(res, 415, { error: 'Envie os dados em formato JSON.' });
        return true;
      }
      const account = await currentAccount(req);
      if (!account) {
        send(res, 401, { error: 'Entre na sua conta novamente.' });
        return true;
      }
      const body = await readJson(req);
      const password = typeof body.password === 'string' ? body.password : '';
      const result = await pool.query('SELECT password_salt, password_hash FROM slime_accounts WHERE id = $1 LIMIT 1', [account.id]);
      const saved = result.rows[0];
      if (!saved || !password || password.length > 128) {
        send(res, 401, { error: 'Confirme sua senha para excluir a conta.' });
        return true;
      }
      const candidate = await makePasswordHash(password, saved.password_salt);
      if (!passwordsMatch(saved.password_hash, candidate)) {
        send(res, 401, { error: 'A senha não confere. A conta não foi excluída.' });
        return true;
      }
      await pool.query('DELETE FROM slime_accounts WHERE id = $1', [account.id]);
      send(res, 200, { ok: true }, { 'Set-Cookie': cookieHeader('', 0, req) });
      return true;
    }

    send(res, 405, { error: 'Método não permitido.' }, { Allow: 'GET, POST, DELETE' });
    return true;
  } catch (error) {
    const status = error.status || 503;
    if (status === 503) console.error('Auth service unavailable:', error.code || error.message);
    send(res, status, {
      error: status === 503
        ? 'O sistema de contas está aguardando a conexão segura com o banco de dados.'
        : status === 413
          ? 'Dados enviados muito grandes.'
          : 'Não foi possível processar a solicitação.'
    });
    return true;
  }
}

module.exports = { handleAuthRequest };
