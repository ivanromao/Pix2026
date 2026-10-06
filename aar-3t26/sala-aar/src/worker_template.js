// Sala do After Act Review: Cloudflare Worker + D1.
// O servidor nunca vê o conteúdo: tudo chega cifrado do navegador (AES-GCM com chave
// derivada da senha do time). Aqui só se confere o hash do token derivado da senha.
// Requisito: um banco D1 ligado a este Worker com o nome de variável DB.

const HTML = __HTML__;
const CAPA_B64 = __CAPA__;

const LIMITE_FALHAS = 30;          // tentativas erradas por IP
const JANELA_FALHAS = 10 * 60e3;   // em 10 minutos
const LIMITE_EVENTOS = 6000;       // teto de registros por sala
const ONLINE_MS = 40e3;

const SCHEMA = [
  'CREATE TABLE IF NOT EXISTS room (id INTEGER PRIMARY KEY CHECK (id = 1), salt TEXT NOT NULL, admin_salt TEXT NOT NULL, team_hash TEXT NOT NULL, admin_hash TEXT NOT NULL, content TEXT NOT NULL, created INTEGER NOT NULL)',
  'CREATE TABLE IF NOT EXISTS events (id INTEGER PRIMARY KEY AUTOINCREMENT, ts INTEGER NOT NULL, admin INTEGER NOT NULL DEFAULT 0, data TEXT NOT NULL)',
  'CREATE TABLE IF NOT EXISTS presence (client TEXT PRIMARY KEY, seen INTEGER NOT NULL)',
  'CREATE TABLE IF NOT EXISTS fails (ip TEXT NOT NULL, ts INTEGER NOT NULL)',
  'CREATE INDEX IF NOT EXISTS fails_ip_ts ON fails (ip, ts)',
];

let schemaPronto = false;
async function garantirSchema(db) {
  if (schemaPronto) return;
  await db.batch(SCHEMA.map((s) => db.prepare(s)));
  schemaPronto = true;
}

const SEG = {
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'referrer-policy': 'no-referrer',
  'x-robots-tag': 'noindex, nofollow',
  'permissions-policy': 'camera=(), microphone=(), geolocation=()',
  'strict-transport-security': 'max-age=31536000',
};

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...SEG, 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

function pagina() {
  return new Response(HTML, {
    headers: {
      ...SEG,
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
      'content-security-policy': [
        "default-src 'none'",
        "script-src 'unsafe-inline'",
        "style-src 'unsafe-inline' https://fonts.googleapis.com",
        'font-src https://fonts.gstatic.com',
        "img-src 'self' data: blob:",
        "connect-src 'self'",
        "base-uri 'none'",
        "form-action 'none'",
        "frame-ancestors 'none'",
      ].join('; '),
    },
  });
}

// a foto é decodificada uma vez por instância, com laço simples (o plano grátis dá 10 ms de CPU por pedido)
let CAPA_BIN = null;
function capa() {
  if (!CAPA_BIN) {
    const s = atob(CAPA_B64);
    const u = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
    CAPA_BIN = u;
  }
  return new Response(CAPA_BIN, { headers: { ...SEG, 'content-type': 'image/jpeg', 'cache-control': 'public, max-age=86400, immutable' } });
}

async function sha256Hex(texto) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function iguais(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

const HEX64 = /^[0-9a-f]{64}$/;
const HEX32 = /^[0-9a-f]{32}$/;

async function tokenConfere(token, hash) {
  if (!token || !HEX64.test(token) || !hash) return false;
  return iguais(await sha256Hex(token), hash);
}

async function bloqueado(db, ip) {
  const r = await db.prepare('SELECT COUNT(*) AS n FROM fails WHERE ip = ? AND ts > ?').bind(ip, Date.now() - JANELA_FALHAS).first();
  return (r?.n || 0) >= LIMITE_FALHAS;
}

async function registrarFalha(db, ip) {
  const agora = Date.now();
  await db.batch([
    db.prepare('INSERT INTO fails (ip, ts) VALUES (?, ?)').bind(ip, agora),
    db.prepare('DELETE FROM fails WHERE ts < ?').bind(agora - 3600e3),
  ]);
}

async function lerCorpo(req, max) {
  const t = await req.text();
  if (t.length > max) throw new Error('grande');
  return JSON.parse(t || '{}');
}

async function api(req, env, url) {
  const db = env.DB;
  const rota = url.pathname;
  const metodo = req.method;
  const ip = req.headers.get('cf-connecting-ip') || 'local';
  const sala = await db.prepare('SELECT salt, admin_salt, team_hash, admin_hash FROM room WHERE id = 1').first();

  if (rota === '/api/room' && metodo === 'GET') {
    return json({ existe: !!sala, salt: sala?.salt || null, adminSalt: sala?.admin_salt || null, agora: Date.now() });
  }

  if (await bloqueado(db, ip)) return json({ erro: 'Muitas tentativas erradas. Espere alguns minutos.' }, 429);

  if (rota === '/api/init' && metodo === 'POST') {
    if (sala) {
      const ok = await tokenConfere(req.headers.get('x-admin-token'), sala.admin_hash);
      if (!ok) {
        await registrarFalha(db, ip);
        return json({ erro: 'Já existe uma sala. Para recriar, informe o código do mediador atual.' }, 403);
      }
    }
    let b;
    try { b = await lerCorpo(req, 400000); } catch { return json({ erro: 'Pedido inválido.' }, 400); }
    if (!HEX32.test(b.salt || '') || !HEX32.test(b.adminSalt || '') || !HEX64.test(b.teamToken || '') || !HEX64.test(b.adminToken || '')
      || typeof b.content !== 'string' || b.content.length < 20 || b.salt === b.adminSalt) {
      return json({ erro: 'Pedido inválido.' }, 400);
    }
    const teamHash = await sha256Hex(b.teamToken);
    const adminHash = await sha256Hex(b.adminToken);
    if (teamHash === adminHash) return json({ erro: 'A senha do time e o código do mediador precisam ser diferentes.' }, 400);
    await db.batch([
      db.prepare('DELETE FROM events'),
      db.prepare('DELETE FROM presence'),
      db.prepare('INSERT OR REPLACE INTO room (id, salt, admin_salt, team_hash, admin_hash, content, created) VALUES (1, ?, ?, ?, ?, ?, ?)')
        .bind(b.salt, b.adminSalt, teamHash, adminHash, b.content, Date.now()),
    ]);
    return json({ ok: true });
  }

  if (!sala) return json({ erro: 'A sala ainda não foi preparada pelo mediador.' }, 404);

  if (!(await tokenConfere(req.headers.get('x-team-token'), sala.team_hash))) {
    await registrarFalha(db, ip);
    return json({ erro: 'Senha incorreta.' }, 401);
  }
  const adminHeader = req.headers.get('x-admin-token');
  const admin = adminHeader ? await tokenConfere(adminHeader, sala.admin_hash) : false;
  if (adminHeader && !admin) {
    await registrarFalha(db, ip);
    return json({ erro: 'Código do mediador incorreto.' }, 401);
  }

  if (rota === '/api/auth' && metodo === 'POST') return json({ ok: true, admin });

  if (rota === '/api/content' && metodo === 'GET') {
    const r = await db.prepare('SELECT content FROM room WHERE id = 1').first();
    return json({ content: r.content });
  }

  if (rota === '/api/events' && metodo === 'GET') {
    const depois = Math.max(0, parseInt(url.searchParams.get('after') || '0', 10) || 0);
    const cliente = (url.searchParams.get('cid') || '').slice(0, 40);
    const agora = Date.now();
    if (url.searchParams.get('hb') === '1' && /^[a-z0-9]{8,40}$/.test(cliente)) {
      await db.prepare('INSERT INTO presence (client, seen) VALUES (?, ?) ON CONFLICT(client) DO UPDATE SET seen = excluded.seen').bind(cliente, agora).run();
    }
    const [ev, on] = await db.batch([
      db.prepare('SELECT id, ts, admin, data FROM events WHERE id > ? ORDER BY id LIMIT 400').bind(depois),
      db.prepare('SELECT COUNT(*) AS n FROM presence WHERE seen > ?').bind(agora - ONLINE_MS),
    ]);
    return json({ eventos: ev.results, agora, online: on.results[0]?.n || 0 });
  }

  if (rota === '/api/events' && metodo === 'POST') {
    let b;
    try { b = await lerCorpo(req, 24000); } catch { return json({ erro: 'Registro grande demais.' }, 400); }
    if (typeof b.data !== 'string' || b.data.length < 20) return json({ erro: 'Pedido inválido.' }, 400);
    const total = await db.prepare('SELECT COUNT(*) AS n FROM events').first();
    if ((total?.n || 0) >= LIMITE_EVENTOS) return json({ erro: 'A sala atingiu o limite de registros.' }, 429);
    const r = await db.prepare('INSERT INTO events (ts, admin, data) VALUES (?, ?, ?) RETURNING id').bind(Date.now(), admin ? 1 : 0, b.data).first();
    return json({ id: r.id });
  }

  if (rota === '/api/reset' && metodo === 'POST') {
    if (!admin) return json({ erro: 'Só o mediador pode apagar a sala.' }, 403);
    await db.batch([db.prepare('DELETE FROM events'), db.prepare('DELETE FROM presence'), db.prepare('DELETE FROM room')]);
    return json({ ok: true });
  }

  return json({ erro: 'Rota desconhecida.' }, 404);
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname === '/' || url.pathname === '/index.html') return pagina();
    if (url.pathname === '/capa.jpg') return capa();
    if (url.pathname === '/favicon.ico') return new Response(null, { status: 204 });
    if (!url.pathname.startsWith('/api/')) return new Response('Não encontrado', { status: 404, headers: SEG });
    if (!env.DB) return json({ erro: 'Banco não configurado: ligue um banco D1 a este Worker com o nome DB.' }, 500);
    try {
      await garantirSchema(env.DB);
      return await api(req, env, url);
    } catch (e) {
      return json({ erro: 'Falha interna no servidor.' }, 500);
    }
  },
};
