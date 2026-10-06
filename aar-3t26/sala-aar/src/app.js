(() => {
'use strict';

/* ============ utilidades ============ */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  if (attrs) for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'style') el.style.cssText = v;
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k === 'value') el.value = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat(Infinity)) if (c != null && c !== false) el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  return el;
}
const enc = new TextEncoder(), dec = new TextDecoder();
const hex = (u8) => [...new Uint8Array(u8)].map((b) => b.toString(16).padStart(2, '0')).join('');
const unhex = (s) => new Uint8Array(s.match(/../g).map((x) => parseInt(x, 16)));
const rand = (n) => crypto.getRandomValues(new Uint8Array(n));
function b64(u8) { let s = ''; const a = new Uint8Array(u8); for (let i = 0; i < a.length; i += 0x8000) s += String.fromCharCode.apply(null, a.subarray(i, i + 0x8000)); return btoa(s); }
const unb64 = (t) => Uint8Array.from(atob(t), (c) => c.charCodeAt(0));
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
const clamp = (n, a, b) => Math.max(a, Math.min(b, n | 0));
const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const pad = (n) => String(n).padStart(2, '0');
const mmss = (ms) => { const t = Math.max(0, Math.round(ms / 1000)); return pad(Math.floor(t / 60)) + ':' + pad(t % 60); };
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toast.k); toast.k = setTimeout(() => t.classList.remove('on'), 2600); }
const reduzMov = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ============ criptografia (navegador) ============ */
const ITER = 250000;
async function derivar(segredo, saltHex) {
  const base = await crypto.subtle.importKey('raw', enc.encode(String(segredo).normalize('NFC')), 'PBKDF2', false, ['deriveBits']);
  const bits = new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: unhex(saltHex), iterations: ITER }, base, 512));
  return { chave: bits.slice(0, 32), token: hex(bits.slice(32)) };
}
const importar = (raw) => crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
async function selar(chave, obj) {
  const iv = rand(12);
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, chave, enc.encode(JSON.stringify(obj)));
  return b64(iv) + '.' + b64(ct);
}
async function abrir(chave, txt) {
  const [a, b] = String(txt).split('.');
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(a) }, chave, unb64(b));
  return JSON.parse(dec.decode(pt));
}

/* ============ sessão e API ============ */
let SALA = null, SESS = {}, CHAVE = null, C = null;
let CID = '';
try { CID = localStorage.getItem('aar.cid') || ''; } catch {}
if (!/^[a-z0-9]{16}$/.test(CID)) { CID = hex(rand(8)); try { localStorage.setItem('aar.cid', CID); } catch {} }
const lerSessao = () => { try { return JSON.parse(sessionStorage.getItem('aar.sess') || 'null'); } catch { return null; } };
const salvarSessao = () => { try { sessionStorage.setItem('aar.sess', JSON.stringify(SESS)); } catch {} };
const limparSessao = () => { try { sessionStorage.removeItem('aar.sess'); } catch {} SESS = {}; };

async function chamar(metodo, rota, corpo, extra = {}) {
  const headers = { 'content-type': 'application/json' };
  if (SESS.team && !extra.semSessao) headers['x-team-token'] = SESS.team;
  if (SESS.admin && !extra.semSessao) headers['x-admin-token'] = SESS.admin;
  Object.assign(headers, extra.headers || {});
  const r = await fetch(rota, { method: metodo, headers, body: corpo ? JSON.stringify(corpo) : undefined, cache: 'no-store', credentials: 'omit' });
  let j = {};
  try { j = await r.json(); } catch {}
  if (!r.ok) { const e = new Error(j.erro || 'Falha de comunicação (' + r.status + ').'); e.status = r.status; throw e; }
  return j;
}

/* ============ peças visuais ============ */
const TRIDENTE = '<svg viewBox="0 0 100 100" aria-hidden="true"><g fill="none" stroke="#e2c579" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round"><path d="M50 12 V92"/><path d="M24 22 V40 Q24 60 50 62 Q76 60 76 40 V22"/><path d="M42 84 H58"/></g><g fill="#e2c579"><path d="M50 2 L57 15 H43 Z"/><path d="M24 12 L31 25 H17 Z"/><path d="M76 12 L83 25 H69 Z"/></g></svg>';
function sonar(tam) {
  const el = h('div', { class: 'sonar', style: tam ? '--s:' + tam + 'px' : null, 'aria-hidden': 'true' },
    h('div', { class: 'varre' }), h('i', { class: 'blip' }), h('i', { class: 'blip' }), h('i', { class: 'blip' }));
  el.insertAdjacentHTML('beforeend', TRIDENTE);
  return el;
}
const aoVivo = () => h('span', { class: 'aovivo' }, h('i'), 'AAR AO VIVO', h('span', { class: 'onda' }, h('span'), h('span'), h('span'), h('span'), h('span')));
function letras(txt, atraso = 0) {
  let i = 0;
  const out = [];
  txt.split(' ').forEach((palavra, k) => {
    if (k) { out.push(' '); i++; }
    out.push(h('span', { class: 'palavra' }, [...palavra].map((ch) => h('span', { class: 'revela-letra', style: 'animation-delay:' + (atraso + (i++) * 0.035).toFixed(3) + 's' }, ch))));
  });
  return out;
}
const MEDALHA = '<svg viewBox="0 0 300 380" aria-hidden="true"><defs>'
  + '<radialGradient id="mg" cx="40%" cy="35%" r="70%"><stop offset="0" stop-color="#fff1c4"/><stop offset=".35" stop-color="#e2c579"/><stop offset=".8" stop-color="#a8822f"/><stop offset="1" stop-color="#7a5c1f"/></radialGradient>'
  + '<linearGradient id="rf" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>'
  + '<clipPath id="mc"><circle cx="150" cy="250" r="110"/></clipPath></defs>'
  + '<path d="M95 0 H145 L170 150 H120 Z" fill="#002bab"/><path d="M155 0 H205 L180 150 H130 Z" fill="#1953d7"/>'
  + '<path d="M110 0 H122 L146 150 H134 Z" fill="#e2c579" opacity=".9"/><path d="M178 0 H190 L166 150 H154 Z" fill="#e2c579" opacity=".9"/>'
  + '<circle cx="150" cy="250" r="118" fill="#5c4415"/><circle cx="150" cy="250" r="110" fill="url(#mg)"/>'
  + '<circle cx="150" cy="250" r="92" fill="none" stroke="#7a5c1f" stroke-width="3" stroke-dasharray="2 6"/>'
  + '<g transform="translate(95 195) scale(1.1)" fill="none" stroke="#5c4415" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"><path d="M50 12 V92"/><path d="M24 22 V40 Q24 60 50 62 Q76 60 76 40 V22"/><path d="M42 84 H58"/></g>'
  + '<g transform="translate(95 195) scale(1.1)" fill="#5c4415"><path d="M50 2 L57 15 H43 Z"/><path d="M24 12 L31 25 H17 Z"/><path d="M76 12 L83 25 H69 Z"/></g>'
  + '<g clip-path="url(#mc)"><rect class="reflexo" x="60" y="120" width="70" height="280" fill="url(#rf)" transform="rotate(20 150 250)"/></g></svg>';
const SELO_OK = '<svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="7" fill="none" stroke="#3fae74" stroke-width="1.5"/><path d="M4.5 8.2 L7 10.6 L11.6 5.6" fill="none" stroke="#3fae74" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const CADEADO = '<svg viewBox="0 0 24 24"><rect x="4" y="10" width="16" height="11" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" stroke-width="2"/></svg>';

/* ============ portão (senha e preparo) ============ */
function aviso(msg, ok) { const a = $('#aviso'); a.textContent = msg || ''; a.classList.toggle('ok', !!ok); }
function avisoP(msg, ok) { const a = $('#avisoP'); a.textContent = msg || ''; a.classList.toggle('ok', !!ok); }
function mostrar(qual) {
  $('#fEntrar').hidden = qual !== 'entrar';
  $('#fPreparar').hidden = qual !== 'preparar';
  $('#semSala').hidden = qual !== 'semSala';
  if (qual === 'preparar') $('#blocoAtual').hidden = !SALA?.existe;
}

async function iniciar() {
  $('#cofreSonar').replaceWith(sonar(84));
  $('#souMed').addEventListener('change', (e) => { $('#blocoCodigo').hidden = !e.target.checked; });
  $$('[data-ir]').forEach((b) => b.addEventListener('click', () => mostrar(b.dataset.ir)));
  $('#fEntrar').addEventListener('submit', entrar);
  $('#fPreparar').addEventListener('submit', preparar);
  $('#arqConteudo').addEventListener('change', lerArquivo);
  try { SALA = await chamar('GET', '/api/room', null, { semSessao: true }); }
  catch (e) { mostrar('entrar'); aviso('Sem conexão com a sala. Confira a internet e recarregue.'); return; }
  if (!SALA.existe) { mostrar('semSala'); return; }
  const salva = lerSessao();
  if (salva && salva.team && salva.chave) {
    SESS = salva;
    try { CHAVE = await importar(unb64(SESS.chave)); await chamar('POST', '/api/auth', {}); await carregarConteudo(); abrirApp(); return; }
    catch { limparSessao(); }
  }
  mostrar('entrar');
  $('#senha').focus();
}

async function entrar(ev) {
  ev.preventDefault();
  const senha = $('#senha').value;
  const med = $('#souMed').checked;
  const codigo = $('#codigo').value;
  if (!senha) return aviso('Digite a senha do time.');
  if (med && !codigo) return aviso('Digite o código do mediador.');
  const btn = $('#btnEntrar'); btn.disabled = true; aviso('Abrindo o cofre...', true);
  try {
    const d = await derivar(senha, SALA.salt);
    SESS = { team: d.token, chave: b64(d.chave) };
    if (med) SESS.admin = (await derivar(codigo, SALA.adminSalt)).token;
    CHAVE = await importar(d.chave);
    const r = await chamar('POST', '/api/auth', {});
    SESS.isAdmin = !!r.admin;
    await carregarConteudo();
    salvarSessao();
    abrirApp();
  } catch (e) {
    SESS = {}; CHAVE = null;
    aviso(e.status === 401 ? (med ? 'Senha ou código do mediador incorretos.' : 'Senha incorreta.') : e.message);
  } finally { btn.disabled = false; }
}

async function carregarConteudo() {
  const r = await chamar('GET', '/api/content');
  C = await abrir(CHAVE, r.content);
}

let ARQ = null;
function lerArquivo(ev) {
  const f = ev.target.files[0];
  const rot = $('#rotArquivo');
  ARQ = null;
  if (!f) return;
  const fr = new FileReader();
  fr.onload = () => {
    try {
      const j = JSON.parse(fr.result);
      if (!Array.isArray(j.fases) || j.fases.length !== 7 || !Array.isArray(j.missao)) throw new Error();
      ARQ = j; rot.textContent = 'Conteúdo carregado: ' + (j.sala || f.name); rot.classList.add('ok'); avisoP('');
    } catch { rot.textContent = 'Esse arquivo não é o conteúdo da sala.'; rot.classList.remove('ok'); }
  };
  fr.readAsText(f);
}

async function preparar(ev) {
  ev.preventDefault();
  const s1 = $('#pSenha').value, s2 = $('#pSenha2').value, c1 = $('#pCodigo').value, c2 = $('#pCodigo2').value;
  if (!ARQ) return avisoP('Escolha o arquivo de conteúdo da sala.');
  if (s1.length < 10) return avisoP('A senha do time precisa ter pelo menos 10 caracteres.');
  if (s1 !== s2) return avisoP('As duas senhas do time não batem.');
  if (c1.length < 8) return avisoP('O código do mediador precisa ter pelo menos 8 caracteres.');
  if (c1 !== c2) return avisoP('Os dois códigos do mediador não batem.');
  if (c1 === s1) return avisoP('O código do mediador precisa ser diferente da senha do time.');
  const btn = $('#btnPreparar'); btn.disabled = true; avisoP('Cifrando o conteúdo no seu navegador...', true);
  try {
    const salt = hex(rand(16)), adminSalt = hex(rand(16));
    const t = await derivar(s1, salt);
    const a = await derivar(c1, adminSalt);
    const content = await selar(await importar(t.chave), ARQ);
    const headers = {};
    if (SALA.existe) {
      const atual = $('#pAtual').value;
      if (!atual) throw new Error('Informe o código do mediador atual para recriar a sala.');
      headers['x-admin-token'] = (await derivar(atual, SALA.adminSalt)).token;
    }
    await chamar('POST', '/api/init', { salt, adminSalt, teamToken: t.token, adminToken: a.token, content }, { headers, semSessao: true });
    SALA = await chamar('GET', '/api/room', null, { semSessao: true });
    limparSessao();
    $('#fPreparar').reset(); ARQ = null; $('#rotArquivo').textContent = 'Escolher o arquivo de conteúdo (.json)'; $('#rotArquivo').classList.remove('ok');
    mostrar('entrar');
    $('#souMed').checked = true; $('#blocoCodigo').hidden = false;
    aviso('Sala pronta e cifrada. Agora entre com a senha do time e o seu código de mediador.', true);
  } catch (e) { avisoP(e.message); }
  finally { btn.disabled = false; }
}

/* ============ estado compartilhado ============ */
let EVENTOS = [], PEND = [], ULT = 0, OFFSET = 0, ONLINE = 0, CONECTADO = true;
let ST = null;
const LIM = { fatos: 3, praticas: 1, medalha: 1 };
const QUADS = ['ca', 'ia', 'cb', 'ib'];
const agora = () => Date.now() + OFFSET;

function reduzir() {
  const st = {
    fase: null, log: [], timer: { fim: 0, dur: 0 }, flips: new Set(), privado: false,
    rodadas: { fatos: 'fechada', praticas: 'fechada', medalha: 'fechada' },
    prontidao: new Map(), fatos: new Map(), porques: ['', '', '', '', '', ''], causas: new Map(),
    praticas: new Map(), anteriores: {}, ordens: [{}, {}, {}], indicados: new Map(), palavras: new Map(),
    envelope: false, turno2: null, fim: false, votos: {}, meus: {},
  };
  for (const c of C.causas || []) st.causas.set(c.id, { id: c.id, t: c.t, q: c.q, semente: true });
  (C.linhaDoTempo.sementes || []).forEach((f, i) => st.fatos.set('s' + i, { id: 's' + i, mes: f.mes, cor: f.cor, t: f.t, cid: '', semente: true }));
  const porCid = { fatos: new Map(), praticas: new Map(), medalha: new Map() };
  const todos = EVENTOS.concat(PEND.map((p) => ({ id: 0, ts: agora(), admin: SESS.isAdmin ? 1 : 0, d: p.d, pend: true })));
  for (const ev of todos) aplicar(st, ev, porCid);
  for (const r of Object.keys(porCid)) {
    const tot = new Map();
    for (const m of porCid[r].values()) for (const [alvo, n] of m) if (n > 0) tot.set(alvo, (tot.get(alvo) || 0) + n);
    st.votos[r] = tot;
    st.meus[r] = porCid[r].get(CID) || new Map();
  }
  ST = st;
}

function aplicar(st, ev, porCid) {
  const d = ev.d;
  if (!d || typeof d !== 'object') return;
  const adm = !!ev.admin;
  const texto = (v, n) => String(v == null ? '' : v).slice(0, n);
  switch (d.tipo) {
    case 'fase': if (adm && C.fases.some((f) => f.id === d.p)) { st.fase = d.p; st.fim = false; st.log.push({ p: d.p, ts: ev.ts }); } break;
    case 'fim': if (adm) { st.fim = true; st.timer = { fim: 0, dur: 0 }; st.log.push({ p: 'fim', ts: ev.ts }); } break;
    case 'timer': if (adm) st.timer = { fim: +d.fim || 0, dur: +d.dur || 0 }; break;
    case 'virar': if (adm) { if (d.on) st.flips.add(d.i); else st.flips.delete(d.i); } break;
    case 'desvirar': if (adm) st.flips.clear(); break;
    case 'privado': if (adm) st.privado = !!d.on; break;
    case 'rodada':
      if (adm && d.r in st.rodadas) { st.rodadas[d.r] = d.estado; if (d.zerar) porCid[d.r].clear(); }
      break;
    case 'pronto': if (d.cid) st.prontidao.set(d.cid, clamp(d.n, 1, 5)); break;
    case 'fato':
      if (d.t && C.linhaDoTempo.meses.some((m) => m.id === d.mes))
        st.fatos.set(d.id, { id: d.id, mes: d.mes, cor: ['verde', 'vermelho', 'azul'].includes(d.cor) ? d.cor : 'azul', t: texto(d.t, 280), cid: d.cid, ts: ev.ts });
      break;
    case 'apagar':
      for (const mapa of [st.fatos, st.praticas, st.indicados, st.causas]) {
        const it = mapa.get(d.id);
        if (it && (adm || (!it.semente && it.cid === d.cid))) mapa.delete(d.id);
      }
      break;
    case 'voto': {
      const r = d.r;
      if (!(r in porCid) || st.rodadas[r] !== 'aberta' || !d.cid) break;
      let m = porCid[r].get(d.cid);
      if (!m) porCid[r].set(d.cid, (m = new Map()));
      const usados = [...m.values()].reduce((a, b) => a + b, 0);
      if (d.v > 0) {
        if (usados < LIM[r] && (r !== 'medalha' || !st.turno2 || st.turno2.includes(d.alvo))) m.set(d.alvo, (m.get(d.alvo) || 0) + 1);
      } else {
        const n = m.get(d.alvo) || 0;
        if (n > 0) m.set(d.alvo, n - 1);
      }
      break;
    }
    case 'porque': if (Number.isInteger(d.i) && d.i >= 0 && d.i < 6) st.porques[d.i] = texto(d.v, 300); break;
    case 'causa': if (d.t) st.causas.set(d.id, { id: d.id, t: texto(d.t, 140), q: QUADS.includes(d.q) ? d.q : 'ca', cid: d.cid }); break;
    case 'mover': { const c = st.causas.get(d.id); if (c && QUADS.includes(d.q)) c.q = d.q; break; }
    case 'pratica': if (d.t) st.praticas.set(d.id, { id: d.id, t: texto(d.t, 200), cid: d.cid }); break;
    case 'anterior': if (Number.isInteger(d.i)) st.anteriores[d.i] = texto(d.v, 20); break;
    case 'ordem': if (d.n >= 0 && d.n < 3 && ['acao', 'dono', 'prazo', 'pronto'].includes(d.f)) st.ordens[d.n][d.f] = texto(d.v, 300); break;
    case 'indicar': if (d.nome) st.indicados.set(d.id, { id: d.id, nome: texto(d.nome, 60).trim(), por: texto(d.por, 200).trim(), cid: d.cid }); break;
    case 'palavra': { const w = limparPalavra(d.w); if (w) st.palavras.set(d.cid, w); else st.palavras.delete(d.cid); break; }
    case 'envelope': if (adm) st.envelope = !!d.on; break;
    case 'turno2': if (adm) { st.turno2 = Array.isArray(d.nomes) && d.nomes.length ? d.nomes.map(String) : null; porCid.medalha.clear(); st.envelope = false; } break;
  }
}
function limparPalavra(w) { return String(w || '').toLowerCase().replace(/[^\p{L}\p{N}-]/gu, '').slice(0, 22); }

async function enviar(d) {
  d.cid = CID; d.u = uid();
  const p = { u: d.u, d };
  PEND.push(p); reconstruir();
  try {
    const data = await selar(CHAVE, d);
    await chamar('POST', '/api/events', { data });
    puxarJa();
  } catch (e) {
    PEND = PEND.filter((x) => x !== p); reconstruir();
    if (e.status === 401) return sairPorSenha();
    toast(e.message || 'Não foi possível enviar.');
  }
}

let puxando = false, repetir = false, timerPuxar = 0, ultHb = 0;
async function puxar() {
  if (puxando) { repetir = true; return; }
  puxando = true; clearTimeout(timerPuxar);
  let novos = 0;
  try {
    for (let volta = 0; volta < 30; volta++) {
      const hb = Date.now() - ultHb > 15000;
      const r = await chamar('GET', '/api/events?after=' + ULT + '&cid=' + CID + (hb ? '&hb=1' : ''));
      if (hb) ultHb = Date.now();
      OFFSET = r.agora - Date.now(); ONLINE = r.online;
      for (const ev of r.eventos) {
        ULT = Math.max(ULT, ev.id);
        let d; try { d = await abrir(CHAVE, ev.data); } catch { continue; }
        EVENTOS.push({ id: ev.id, ts: ev.ts, admin: ev.admin, d });
        PEND = PEND.filter((p) => p.u !== d.u);
        novos++;
      }
      if (r.eventos.length < 400) break;
    }
    CONECTADO = true;
  } catch (e) {
    CONECTADO = false;
    if (e.status === 401) { puxando = false; return sairPorSenha(); }
  }
  puxando = false;
  if (novos) reconstruir(); else renderBarra();
  if (repetir) { repetir = false; return puxar(); }
  const calmo = ST && (ST.fim || !ST.fase);
  timerPuxar = setTimeout(puxar, document.hidden ? (calmo ? 60000 : 10000) : (ST && ST.fim ? 20000 : !ST?.fase ? 4000 : 1500));
}
function puxarJa() { clearTimeout(timerPuxar); puxar(); }
function sairPorSenha() { limparSessao(); toast('A sala mudou de senha. Entre de novo.'); setTimeout(() => location.reload(), 1500); }

/* ============ app ============ */
let faseVista = null, envelopeVisto = false, primeiro = true;
function reconstruir() { if (!C) return; reduzir(); renderTudo(); }

function abrirApp() {
  $('#portao').hidden = true;
  const app = $('#app'); app.hidden = false;
  document.title = C.sala || 'After Act Review';
  montarBarra();
  const raiz = $('#conteudo');
  raiz.replaceChildren(hero(), secao01(), secao02(), secao03(), secao04(), secao05(), secao06(), secao07(), rodape());
  if (SESS.isAdmin) montarQG();
  observarSurgir();
  contarNumeros();
  reduzir(); renderTudo();
  puxar();
  setInterval(tique, 250);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) puxarJa(); });
}

function fase(id) { return C.fases.find((f) => f.id === id); }

function montarBarra() {
  const rota = $('#rota');
  rota.replaceChildren(h('div', { class: 'trilha', id: 'trilha' }),
    ...C.fases.map((f) => h('a', { class: 'parada' + (f.id === '07' ? ' honra' : ''), href: '#f-' + f.id, dataset: { f: f.id }, title: f.rotaSub },
      h('b', null, f.id), h('span', null, f.rotaSub))));
  $('#marcaSonar').replaceWith(sonar(42));
  $('#seguir').addEventListener('change', () => { if ($('#seguir').checked && ST?.fase) irPara(ST.fase); });
}

function secao(f, ...corpo) {
  return h('section', { class: 'fase' + (f.id === '07' ? ' honra' : ''), id: 'f-' + f.id },
    h('div', { class: 'faixa surge' },
      h('div', { class: 'num' }, f.id),
      h('div', null, h('h2', null, f.titulo), h('div', { class: 'mono etapa' }, f.etapa)),
      h('div', { class: 'tempo' }, h('b', null, f.hora), f.min + ' MIN')),
    h('p', { class: 'pergunta surge' }, f.pergunta),
    h('p', { class: 'instrucao surge' }, f.instrucao),
    ...corpo);
}

function hero() {
  return h('section', { class: 'hero', id: 'topo' },
    h('div', { class: 'foto' }), h('div', { class: 'esteira' }),
    h('div', { class: 'conteudo' },
      h('div', { class: 'linha1' }, sonar(170),
        h('div', null, h('div', { class: 'mono' }, C.telemetria), h('div', { style: 'margin-top:14px' }, aoVivo()))),
      h('h1', null, h('span', null, letras(C.titulo)), h('span', { class: 'l2' }, h('span', null, letras(C.subtitulo, 0.5)), h('i', { class: 'seta' }))),
      h('p', { class: 'chamada' }, C.chamada),
      h('p', { class: 'apoio' }, C.apoio),
      h('div', { class: 'numeros' }, C.numeros.map((n) => h('div', { class: 'numero surge' }, h('b', { dataset: { alvo: n.n } }, n.n), h('span', { class: 'mono' }, n.t))))),
    h('div', { class: 'desce' }, 'ROLE PARA A ROTA'));
}

function secao01() {
  const a = C.abertura;
  return secao(fase('01'),
    h('div', { class: 'grade2' },
      h('div', { style: 'display:grid;gap:22px' },
        h('div', { class: 'ownership surge' }, h('div', { class: 'mono' }, 'Responsabilidade extrema  ·  quem lidera fala primeiro'),
          h('blockquote', null, a.ownership), h('div', { class: 'mono', style: 'color:var(--steel)' }, a.assinatura)),
        h('div', { class: 'painel surge' }, h('div', { class: 'mono rotulo' }, 'Regras da sala'),
          h('ol', { class: 'regras' }, a.regras.map((r) => h('li', null, r))),
          h('p', { class: 'diretriz' }, a.diretriz))),
      h('div', { style: 'display:grid;gap:22px;align-content:start' },
        h('div', { class: 'painel surge' },
          h('div', { class: 'rotulo' }, h('span', { class: 'mono' }, 'Prontidão  ·  como você chega ao fim do 3T?'), h('span', { class: 'mono', id: 'totProntidao' })),
          h('div', { class: 'prontidao', id: 'prontidao' })),
        h('div', { class: 'painel surge' }, h('div', { class: 'mono rotulo' }, 'Tripulação  ·  em ordem alfabética, sem cargo'),
          h('div', { class: 'tripulacao' }, a.tripulacao.map((n) => h('span', null, n))),
          h('p', { class: 'dica', style: 'margin-top:14px;font-size:14px' }, a.novos)))));
}

function secao02() {
  const linhas = C.missao.map((m) => h('div', { class: 'linhaMissao surge' },
    h('div', { class: 'be' }, h('div', { class: 'mono' }, m.qbr + '  ·  ' + m.be), h('p', null, m.titulo)),
    h('div', { class: 'feats' }, m.features.map((f) => h('div', { class: 'feat' }, f.bo ? h('b', null, f.bo) : null, f.t))),
    h('div', { class: 'flecha' }, h('i')),
    (() => { const r = h('div', { class: 'real' }, h('div', { class: 'selo' }), h('div', null, m.real)); r.firstChild.insertAdjacentHTML('afterbegin', SELO_OK); r.firstChild.append(m.status); return r; })()));
  const cartas = C.validador.map((v, i) => h('button', { class: 'carta3d surge', type: 'button', dataset: { i }, onclick: () => clicarCarta(i), 'aria-label': 'Carta do validador: ' + v.frente },
    h('div', { class: 'giro' },
      h('div', { class: 'lado frente' }, h('div', { class: 'mono' }, v.frente), h('p', null, v.pergunta), h('small', null, 'Clique para virar')),
      h('div', { class: 'lado verso' }, h('div', { class: 'mono', style: 'color:#c9dbff' }, v.frente), h('b', null, v.numero), h('p', null, v.fato)))));
  return secao(fase('02'),
    h('div', { class: 'missao' },
      h('div', null,
        h('div', { class: 'cabecalhoMissao mono' }, h('span', null, 'Pergunta 1  ·  BE'), h('span', null, 'Features'), h('span'), h('span', null, 'Pergunta 2  ·  o que aconteceu')),
        h('div', { class: 'linhas' }, linhas),
        h('div', { class: 'regra surge' }, C.regra),
        h('div', { class: 'mono', style: 'margin-top:26px' }, 'Missões fora do plano, cumpridas'),
        h('div', { class: 'fora surge' }, C.foraDoPlano.map((x) => h('div', null, h('b', null, x.t), x.d)))),
      h('div', null, h('div', { class: 'mono rotulo' }, 'Cartas do validador  ·  clique para virar'), h('div', { class: 'cartas', id: 'cartas' }, cartas))));
}

/* gantt genérico */
const MESES = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
const dia = (s) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)) / 864e5;
function gantt(def, ordem, rot = 230) {
  const i0 = dia(def.inicio), i1 = dia(def.fim) + 1, tot = i1 - i0;
  const meses = [];
  let y = +def.inicio.slice(0, 4), m = +def.inicio.slice(5, 7) - 1;
  while (true) {
    const ini = Math.max(i0, Date.UTC(y, m, 1) / 864e5), fim = Math.min(i1, Date.UTC(y, m + 1, 1) / 864e5);
    if (ini >= i1) break;
    meses.push({ n: MESES[m], w: fim - ini, x: ini - i0 });
    m++; if (m > 11) { m = 0; y++; }
  }
  const itens = [...def.itens].sort((a, b) => ordem.indexOf(a.tipo) - ordem.indexOf(b.tipo));
  const grades = meses.slice(1).map((mm) => h('div', { class: 'grade', style: 'left:' + (mm.x / tot * 100) + '%' }));
  return h('div', { class: 'gantt surge', style: '--rot:' + rot + 'px' },
    h('div', { class: 'meses', style: 'grid-template-columns:' + meses.map((mm) => mm.w + 'fr').join(' ') }, meses.map((mm) => h('span', null, mm.n))),
    itens.map((it, k) => {
      const a = dia(it.de) - i0, b = dia(it.ate) + 1 - i0;
      return h('div', { class: 'lin' }, h('div', { class: 't', title: it.t }, it.t),
        h('div', { class: 'pista' }, k === 0 ? grades : grades.map((g) => g.cloneNode()),
          h('div', { class: 'b ' + it.tipo, title: it.t, style: 'left:' + (a / tot * 100) + '%;width:' + (it.tipo === 'marco' ? '12px' : Math.max(0.6, (b - a) / tot * 100) + '%') + ';transition-delay:' + (k * 0.04).toFixed(2) + 's' })));
    }));
}
const legenda = (pares) => h('div', { class: 'legenda' }, pares.map(([c, t]) => h('span', null, h('i', { style: 'background:' + c }), t)));

function secao03() {
  const meses = C.linhaDoTempo.meses;
  return secao(fase('03'),
    h('div', { class: 'painel surge' },
      h('div', { class: 'mono rotulo' }, 'O que o sistema registrou  ·  sprints, férias, marcos e incidentes'),
      gantt(C.linhaDoTempo, ['sprint', 'ferias', 'incidente', 'marco']),
      legenda([['var(--francia)', 'Sprint'], ['var(--gold2)', 'Férias'], ['var(--red)', 'Incidente'], ['var(--green)', 'Marco']])),
    h('div', { style: 'margin-top:30px' },
      h('div', { id: 'faixaPrivada' }),
      h('form', { class: 'compor', id: 'comporFato', onsubmit: (e) => { e.preventDefault(); novoFato(); } },
        h('input', { class: 'campo', id: 'txtFato', maxlength: '280', placeholder: 'Um fato: o que aconteceu, quando e com qual efeito', autocomplete: 'off' }),
        h('select', { class: 'campo', id: 'mesFato', 'aria-label': 'Mês' }, meses.map((m) => h('option', { value: m.id }, m.nome[0] + m.nome.slice(1).toLowerCase()))),
        h('div', { class: 'cores', id: 'corFato', role: 'radiogroup', 'aria-label': 'Tipo do fato' },
          [['verde', 'Deu certo'], ['vermelho', 'Nos atingiu'], ['azul', 'Aprendizado']].map(([c, t], i) =>
            h('button', { type: 'button', class: c + (i === 0 ? ' sel' : ''), title: t, 'aria-label': t, dataset: { c }, onclick: (e) => { $$('#corFato button').forEach((b) => b.classList.remove('sel')); e.currentTarget.classList.add('sel'); } }))),
        h('button', { class: 'btn', type: 'submit' }, 'Adicionar')),
      h('div', { class: 'meses3' }, meses.map((m) => h('div', { class: 'mes surge', dataset: { m: m.id } }, h('h3', null, m.nome, h('small', { id: 'cont-' + m.id })), h('div', { class: 'fatos', id: 'fatos-' + m.id }))))));
}

function secao04() {
  const NOMES = ['Problema mais votado', '1º por quê', '2º por quê', '3º por quê', '4º por quê', 'Causa raiz'];
  const niveis = NOMES.map((n, i) => h('div', { class: 'porque' + (i === 5 ? ' raiz' : ''), id: 'pq-' + i },
    h('span', { class: 'mono' }, n),
    h('input', { class: 'campo', maxlength: '300', placeholder: i === 0 ? 'O fato mais votado' : 'Por que isso aconteceu?', dataset: { i },
      oninput: (e) => debounce('pq' + i, () => enviar({ tipo: 'porque', i, v: e.target.value }), 700),
      onchange: (e) => { cancelDebounce('pq' + i); enviar({ tipo: 'porque', i, v: e.target.value }); } })));
  const Q = { ca: 'Controlável  ·  impacto alto  ·  atacar no 4T', ia: 'Incontrolável  ·  impacto alto  ·  escalar e se proteger', cb: 'Controlável  ·  impacto baixo  ·  ajuste rápido', ib: 'Incontrolável  ·  impacto baixo  ·  monitorar' };
  return secao(fase('04'),
    h('div', { class: 'grade2' },
      h('div', { class: 'painel surge' },
        h('div', { class: 'rotulo' }, h('span', { class: 'mono' }, 'Votação nos fatos  ·  3 votos por pessoa'), h('span', { class: 'mono', id: 'meusVotosFatos' })),
        h('div', { id: 'estadoFatos', class: 'dica', style: 'margin:0 0 12px' }),
        h('div', { class: 'fatos', id: 'listaVotoFatos' })),
      h('div', { class: 'painel surge' },
        h('div', { class: 'rotulo' }, h('span', { class: 'mono' }, 'Árvore dos 5 porquês'), h('button', { class: 'btn mini fantasma', id: 'usarTop', type: 'button', hidden: true, onclick: usarTopo }, 'Trazer o mais votado')),
        h('div', { class: 'profundidade' }, h('div', { class: 'sonda' }, h('div', { class: 'ping', id: 'ping', style: 'top:4%' })), h('div', { class: 'niveis' }, niveis)))),
    h('div', { class: 'painel surge', style: 'margin-top:22px' },
      h('div', { class: 'rotulo' }, h('span', { class: 'mono' }, 'Controlável x incontrolável  ·  arraste as causas'), h('span', { class: 'dica', style: 'margin:0' }, 'Controlável a gente ataca amanhã. Incontrolável a gente escala e se protege.')),
      h('div', { class: 'matriz', id: 'matriz' },
        h('span'), h('div', { class: 'eixoX', style: 'color:var(--green);background:rgba(63,174,116,.1)' }, 'CONTROLÁVEL'), h('div', { class: 'eixoX', style: 'color:var(--amber);background:rgba(213,154,55,.1)' }, 'INCONTROLÁVEL'),
        h('div', { class: 'eixoY' }, 'IMPACTO ALTO'),
        h('div', { class: 'quad ca', dataset: { q: 'ca' } }, h('h4', null, Q.ca)), h('div', { class: 'quad ia', dataset: { q: 'ia' } }, h('h4', null, Q.ia)),
        h('div', { class: 'eixoY' }, 'IMPACTO BAIXO'),
        h('div', { class: 'quad cb', dataset: { q: 'cb' } }, h('h4', null, Q.cb)), h('div', { class: 'quad ib', dataset: { q: 'ib' } }, h('h4', null, Q.ib))),
      h('form', { class: 'compor', style: 'grid-template-columns:1fr auto', onsubmit: (e) => { e.preventDefault(); const i = $('#txtCausa'); const t = i.value.trim(); if (!t) return; enviar({ tipo: 'causa', id: uid(), t, q: 'ca' }); i.value = ''; } },
        h('input', { class: 'campo', id: 'txtCausa', maxlength: '140', placeholder: 'Nova causa (entra em controlável, arraste para o lugar certo)', autocomplete: 'off' }),
        h('button', { class: 'btn', type: 'submit' }, 'Adicionar causa'))));
}

function secao05() {
  return secao(fase('05'),
    h('div', { class: 'grade2' },
      h('div', { class: 'painel surge' }, h('div', { class: 'mono rotulo' }, 'As três que ficam  ·  doutrina do squad'), h('div', { class: 'podio', id: 'podio' })),
      h('div', { class: 'painel surge' },
        h('div', { class: 'rotulo' }, h('span', { class: 'mono' }, 'Práticas do 3T  ·  um card por pessoa'), h('span', { class: 'mono', id: 'meusVotosPraticas' })),
        h('form', { class: 'compor', style: 'grid-template-columns:1fr auto;margin-top:0', onsubmit: (e) => { e.preventDefault(); const i = $('#txtPratica'); const t = i.value.trim(); if (!t) return; enviar({ tipo: 'pratica', id: uid(), t }); i.value = ''; } },
          h('input', { class: 'campo', id: 'txtPratica', maxlength: '200', placeholder: 'Uma prática que funcionou no 3T', autocomplete: 'off' }),
          h('button', { class: 'btn', type: 'submit' }, 'Adicionar')),
        h('div', { id: 'estadoPraticas', class: 'dica', style: 'margin:0 0 12px' }),
        h('div', { class: 'cardsLivres', id: 'praticas' }))));
}

function secao06() {
  const ESTADOS = ['Cumprido', 'Em andamento', 'Não saiu'];
  const tab = h('div', { class: 'anteriores' }, C.compromissosAnteriores.map((c, i) => h('div', { class: 'anterior' },
    h('div', { class: 't' }, c.t), h('div', { class: 'mono' }, c.prazo ? 'prazo ' + c.prazo : 'sem data'),
    h('div', { class: 'estado', dataset: { i } }, ESTADOS.map((s) => h('button', { type: 'button', dataset: { v: s }, onclick: () => enviar({ tipo: 'anterior', i, v: ST.anteriores[i] === s ? '' : s }) }, s))))));
  const crew = h('datalist', { id: 'crew' }, C.abertura.tripulacao.map((n) => h('option', { value: n })));
  const ordens = ['I', 'II', 'III'].map((rom, n) => h('div', { class: 'ordem surge', id: 'ordem-' + n },
    h('div', { class: 'carimbo' }, 'Em montagem'),
    h('div', { class: 'rom' }, rom),
    campoOrdem(n, 'acao', 'Ação técnica', 'textarea', 'Verbo mais objeto. Ex.: levantar o sinal amarelo na daily'),
    campoOrdem(n, 'dono', 'Dono', 'input', 'Uma pessoa'),
    campoOrdem(n, 'prazo', 'Prazo', 'date'),
    h('div', { class: 'alerta', id: 'alerta-' + n }),
    campoOrdem(n, 'pronto', 'Pronto quando', 'textarea', 'O sinal de que deu certo')));
  return secao(fase('06'), crew,
    h('div', { class: 'grade2' },
      h('div', { class: 'painel surge' }, h('div', { class: 'mono rotulo' }, 'Antes  ·  os compromissos da retrô das sprints 16 e 17 saíram?'), tab),
      h('div', { class: 'painel surge' }, h('div', { class: 'mono rotulo' }, 'O que pesa nos prazos do 4T'),
        gantt(C.calendario4T, ['marco', 'congelamento', 'ferias'], 200),
        legenda([['var(--green)', 'Marco'], ['var(--red)', 'Congelamento'], ['var(--gold2)', 'Férias']]))),
    h('div', { class: 'mono', style: 'margin:30px 0 14px' }, 'Agora  ·  compromissos de combate do 4T  ·  máximo de três'),
    h('div', { class: 'ordens' }, ordens),
    h('p', { class: 'dica', style: 'margin-top:14px' }, 'Quando os três estiverem prontos, o mediador baixa a planilha e cria os itens no Jira no mesmo dia.'));
}
function campoOrdem(n, f, rotulo, tipo, ph) {
  const id = 'o' + n + f;
  const attrs = { class: 'campo', id, dataset: { n, f }, placeholder: ph || null,
    oninput: (e) => { if (f === 'prazo') validarPrazo(n, e.target.value); debounce(id, () => enviar({ tipo: 'ordem', n, f, v: e.target.value }), 700); },
    onchange: (e) => { cancelDebounce(id); enviar({ tipo: 'ordem', n, f, v: e.target.value }); } };
  let el;
  if (tipo === 'textarea') el = h('textarea', { ...attrs, maxlength: '300', rows: '2' });
  else if (tipo === 'date') el = h('input', { ...attrs, type: 'date', min: '2026-10-01', max: '2027-03-31' });
  else el = h('input', { ...attrs, maxlength: '80', list: 'crew', autocomplete: 'off' });
  return [h('label', { class: 'mono', for: id }, rotulo), el];
}
function prazoValido(v) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v || '')) return false;
  const y = +v.slice(0, 4), m = +v.slice(5, 7), d = +v.slice(8, 10);
  return d === 15 || d === new Date(y, m, 0).getDate();
}
function validarPrazo(n, v) {
  const a = $('#alerta-' + n);
  if (a) a.textContent = v && !prazoValido(v) ? 'Fora da regra: use o dia 15 ou o último dia do mês.' : '';
}

function secao07() {
  const hon = C.honra;
  const med = h('div', { class: 'medalha surge' }); med.innerHTML = MEDALHA;
  return secao(fase('07'),
    h('div', { class: 'honraGrade' },
      h('div', { class: 'painel ouro surge', style: 'display:grid;grid-template-columns:1fr 1fr;align-items:center;gap:10px' },
        med, h('div', { class: 'premio' }, h('div', { class: 'mono', style: 'color:var(--steel)' }, 'Prêmio'), h('b', null, hon.premio), h('div', { class: 'tipo' }, hon.premioTipo), h('p', { class: 'dica', style: 'font-size:15px;color:var(--ice)' }, hon.premioRegra))),
      h('div', { class: 'painel ouro surge' },
        h('div', { class: 'rotulo' }, h('span', { class: 'mono', style: 'color:var(--gold2)' }, 'Indicados  ·  nome e motivo'), h('span', { class: 'mono', id: 'estadoMedalha' })),
        h('form', { class: 'indicar', onsubmit: (e) => { e.preventDefault(); const n = $('#indNome').value.trim(); const p = $('#indPor').value.trim(); if (!n) return toast('Escreva o nome de quem você indica.'); enviar({ tipo: 'indicar', id: uid(), nome: n, por: p }); $('#indNome').value = ''; $('#indPor').value = ''; } },
          h('input', { class: 'campo', id: 'indNome', list: 'crew', maxlength: '60', placeholder: 'Nome', autocomplete: 'off' }),
          h('input', { class: 'campo', id: 'indPor', maxlength: '200', placeholder: 'Por que fez a diferença', autocomplete: 'off' }),
          h('button', { class: 'btn ouro', type: 'submit' }, 'Indicar')),
        h('div', { class: 'indicados', id: 'indicados' }))),
    h('div', { class: 'envelopeArea' },
      h('div', { class: 'envelope', id: 'envelope' }, h('div', { class: 'corpo' }), h('div', { class: 'bilhete', id: 'bilhete' }, h('b', null, 'Medalha Tridente')), h('div', { class: 'frenteEnv' }), h('div', { class: 'aba' }), h('div', { class: 'lacre' }, 'AAR')),
      h('div', null,
        h('div', { class: 'rotulo' }, h('span', { class: 'mono' }, 'Em uma palavra: como você sai deste AAR?'), h('span', { class: 'mono', id: 'totPalavras' })),
        h('form', { class: 'compor', style: 'grid-template-columns:1fr auto;margin-top:0', onsubmit: (e) => { e.preventDefault(); const w = limparPalavra($('#txtPalavra').value); if (!w) return; enviar({ tipo: 'palavra', w }); $('#txtPalavra').value = ''; } },
          h('input', { class: 'campo', id: 'txtPalavra', maxlength: '22', placeholder: 'Uma palavra', autocomplete: 'off' }),
          h('button', { class: 'btn', type: 'submit' }, 'Enviar')),
        h('div', { class: 'nuvem', id: 'nuvem' }))),
    h('div', { class: 'hooyah', id: 'hooyah' }, [...'HOOYAH!'].map((ch, i) => h('span', { style: 'animation-delay:' + (i * 0.08) + 's' }, ch))),
    h('p', { class: 'dica', style: 'text-align:center;font-size:16px' }, hon.encerramento));
}

function rodape() {
  return h('footer', null,
    h('div', { style: 'display:flex;justify-content:space-between;gap:20px;flex-wrap:wrap;align-items:center' },
      h('span', null, (C.sala || 'AAR') + '  ·  sala cifrada de ponta a ponta. Sem a senha, ninguém consegue ler este conteúdo, nem o servidor.'),
      h('button', { class: 'btn mini fantasma', type: 'button', onclick: () => { limparSessao(); location.reload(); } }, 'Sair da sala')));
}

/* ============ render dinâmico ============ */
function renderTudo() {
  renderBarra(); renderProntidao(); renderCartas(); renderFatos(); renderVotoFatos(); renderPorques(); renderCausas();
  renderPraticas(); renderAnteriores(); renderOrdens(); renderIndicados(); renderEnvelope(); renderNuvem(); renderHooyah();
  if (SESS.isAdmin) renderQG();
  seguirFase();
  primeiro = false;
}

function renderBarra() {
  if (!ST) return;
  const idx = ST.fase ? C.fases.findIndex((f) => f.id === ST.fase) : -1;
  $$('#rota .parada').forEach((p, i) => { p.classList.toggle('atual', i === idx && !ST.fim); p.classList.toggle('feita', i < idx || (ST.fim && i <= idx)); });
  const par = $$('#rota .parada');
  const trilha = $('#trilha');
  if (trilha && par.length) {
    const base = $('#rota').getBoundingClientRect().left;
    const alvo = idx >= 0 ? par[idx].getBoundingClientRect() : null;
    trilha.style.width = alvo ? Math.max(0, alvo.left - base + alvo.width / 2) + 'px' : '0px';
  }
  $$('.fase').forEach((s) => s.classList.toggle('atual', !!ST.fase && s.id === 'f-' + ST.fase && !ST.fim));
  const b = $('#bordo');
  b.classList.toggle('off', !CONECTADO);
  $('#bordoTxt').textContent = CONECTADO ? ONLINE + ' a bordo' : 'sem conexão';
}

function tique() {
  if (!ST) return;
  const r = $('#relogio'), txt = $('#relogioTxt'), anel = $('#anel');
  const C2 = 2 * Math.PI * 14;
  anel.style.strokeDasharray = C2;
  if (ST.timer.fim) {
    const rest = ST.timer.fim - agora();
    txt.textContent = mmss(rest);
    const frac = ST.timer.dur ? Math.max(0, rest) / ST.timer.dur : 0;
    anel.style.strokeDashoffset = C2 * (1 - frac);
    r.classList.toggle('alerta', rest > 0 && rest <= 60000);
    r.classList.toggle('zero', rest <= 0);
  } else {
    const f = ST.fase ? fase(ST.fase) : C.fases[0];
    txt.textContent = pad(f.min) + ':00';
    anel.style.strokeDashoffset = 0;
    r.classList.remove('alerta', 'zero');
  }
  if (SESS.isAdmin) atualizarPlanoVoo();
}

function irPara(id) {
  const el = document.getElementById('f-' + id);
  if (el) el.scrollIntoView({ behavior: reduzMov ? 'auto' : 'smooth', block: 'start' });
}
function seguirFase() {
  if (!ST.fase || ST.fase === faseVista) return;
  faseVista = ST.fase;
  if ($('#seguir').checked) setTimeout(() => irPara(ST.fase), primeiro ? 600 : 50);
}

function renderProntidao() {
  const box = $('#prontidao');
  const cont = [0, 0, 0, 0, 0];
  for (const n of ST.prontidao.values()) cont[n - 1]++;
  const tot = ST.prontidao.size, meu = ST.prontidao.get(CID);
  $('#totProntidao').textContent = tot ? tot + (tot === 1 ? ' resposta' : ' respostas') : '';
  const max = Math.max(1, ...cont);
  if (!box.childElementCount) {
    for (let l = 5; l >= 1; l--) {
      box.append(h('button', { class: 'nivel', type: 'button', dataset: { l }, onclick: () => enviar({ tipo: 'pronto', n: l }) },
        h('i', { class: 'barra' }), h('b', null, l), h('span', null, C.abertura.prontidao[l - 1]), h('span', { class: 'n' })));
    }
  }
  $$('.nivel', box).forEach((b) => {
    const l = +b.dataset.l;
    b.classList.toggle('meu', meu === l);
    $('.barra', b).style.width = (cont[l - 1] / max * 100) + '%';
    $('.n', b).textContent = cont[l - 1] ? String(cont[l - 1]) : '';
  });
}

let flipsLocais = new Set();
function clicarCarta(i) {
  if (SESS.isAdmin) enviar({ tipo: 'virar', i, on: !ST.flips.has(i) });
  else { if (flipsLocais.has(i)) flipsLocais.delete(i); else flipsLocais.add(i); renderCartas(); }
}
function renderCartas() { $$('#cartas .carta3d').forEach((c) => { const i = +c.dataset.i; c.classList.toggle('virada', ST.flips.has(i) || flipsLocais.has(i)); }); }

function visivelFato(f) { return !ST.privado || f.semente || f.cid === CID; }
function cardFato(f, modo) {
  const oculto = modo !== 'voto' && !visivelFato(f);
  const el = h('div', { class: 'fato ' + f.cor + (oculto ? ' oculto' : ''), dataset: { id: f.id } }, oculto ? ' ' : f.t);
  if (!oculto && (f.cid === CID || SESS.isAdmin) && modo !== 'voto') el.append(h('button', { class: 'x', type: 'button', title: 'Apagar', 'aria-label': 'Apagar', onclick: () => enviar({ tipo: 'apagar', id: f.id }) }, '×'));
  return el;
}
function renderFatos() {
  const fp = $('#faixaPrivada');
  fp.replaceChildren();
  if (ST.privado) { const d = h('div', { class: 'faixaPrivada' }, 'Modo privado ligado. Cada pessoa vê só o que escreveu. O mediador revela quando o timer zerar.'); d.insertAdjacentHTML('afterbegin', CADEADO); fp.append(d); }
  for (const m of C.linhaDoTempo.meses) {
    const lista = [...ST.fatos.values()].filter((f) => f.mes === m.id);
    const box = $('#fatos-' + m.id);
    trocarFilhos(box, lista.map((f) => cardFato(f)), (f) => f.dataset.id + (f.classList.contains('oculto') ? 'o' : ''));
    $('#cont-' + m.id).textContent = lista.length ? lista.length + (lista.length === 1 ? ' fato' : ' fatos') : '';
  }
}
// troca filhos preservando os que não mudaram (evita animar tudo de novo)
function trocarFilhos(box, novos, chave) {
  const antigos = new Map([...box.children].map((c) => [chave(c), c]));
  const frag = [];
  for (const n of novos) {
    const k = chave(n);
    const a = antigos.get(k);
    if (a && a.outerHTML === n.outerHTML) frag.push(a);
    else frag.push(n);
  }
  box.replaceChildren(...frag);
}

function totalMeus(r) { let t = 0; for (const n of ST.meus[r].values()) t += n; return t; }
function renderVotoFatos() {
  const est = ST.rodadas.fatos;
  const mostra = est === 'revelada';
  const restam = LIM.fatos - totalMeus('fatos');
  $('#meusVotosFatos').textContent = est === 'aberta' ? (restam === 1 ? '1 voto restante' : restam + ' votos restantes') : '';
  $('#estadoFatos').textContent = est === 'fechada' ? 'A votação abre quando o mediador chegar nesta pergunta.' : est === 'aberta' ? 'Votação aberta. Pode colocar mais de um voto no mesmo fato.' : 'Votação encerrada. O mais votado desce a árvore.';
  let lista = [...ST.fatos.values()].filter((f) => !ST.privado || visivelFato(f));
  if (est === 'revelada') lista.sort((a, b) => (ST.votos.fatos.get(b.id) || 0) - (ST.votos.fatos.get(a.id) || 0));
  const topo = topoFatos();
  const box = $('#listaVotoFatos');
  if (!lista.length) { box.replaceChildren(h('p', { class: 'vazio' }, 'Os fatos da linha do tempo aparecem aqui.')); return; }
  box.replaceChildren(...lista.map((f) => {
    const el = cardFato(f, 'voto');
    if (est === 'revelada' && topo && f.id === topo.id) el.classList.add('top');
    const meus = ST.meus.fatos.get(f.id) || 0;
    const tot = ST.votos.fatos.get(f.id) || 0;
    el.append(h('div', { class: 'votos' },
      est === 'aberta' ? [h('button', { type: 'button', 'aria-label': 'Tirar voto', disabled: meus === 0 || null, onclick: () => enviar({ tipo: 'voto', r: 'fatos', alvo: f.id, v: -1 }) }, '−'),
        h('button', { type: 'button', 'aria-label': 'Votar', disabled: restam <= 0 || null, onclick: () => enviar({ tipo: 'voto', r: 'fatos', alvo: f.id, v: 1 }) }, '+')] : null,
      h('span', { class: 'pts' }, Array.from({ length: meus }, () => h('i'))),
      mostra && tot ? h('span', { class: 'total' }, tot + (tot === 1 ? ' voto' : ' votos')) : null));
    return el;
  }));
}
function topoFatos() {
  let best = null, n = 0;
  for (const f of ST.fatos.values()) { const v = ST.votos.fatos.get(f.id) || 0; if (v > n) { n = v; best = f; } }
  return best;
}
function usarTopo() { const t = topoFatos(); if (t) { $('#pq-0 input').value = t.t; enviar({ tipo: 'porque', i: 0, v: t.t }); } }

function renderPorques() {
  let fundo = -1;
  ST.porques.forEach((v, i) => {
    const row = $('#pq-' + i), inp = $('input', row);
    if (document.activeElement !== inp && !DEB.has('pq' + i) && inp.value !== v) inp.value = v;
    row.classList.toggle('cheio', !!v.trim());
    if (v.trim()) fundo = i;
  });
  $('#ping').style.top = (4 + Math.max(0, fundo) * 17.4) + '%';
  $('#usarTop').hidden = !(ST.rodadas.fatos === 'revelada' && topoFatos());
}

function renderCausas() {
  for (const q of QUADS) {
    const quad = $('.quad.' + q);
    const lista = [...ST.causas.values()].filter((c) => c.q === q);
    const cards = lista.map((c) => h('div', { class: 'causa', dataset: { id: c.id }, style: '--c:' + (q[0] === 'c' ? 'var(--green)' : 'var(--amber)'), onpointerdown: (e) => arrastar(e, c) }, c.t));
    quad.replaceChildren(quad.firstChild, ...cards);
  }
}
function arrastar(e, causa) {
  if (e.button !== 0) return;
  const orig = e.currentTarget;
  const r = orig.getBoundingClientRect();
  const dx = e.clientX - r.left, dy = e.clientY - r.top;
  let fant = null, alvo = null, moveu = false;
  const mover = (ev) => {
    if (!moveu && Math.hypot(ev.clientX - e.clientX, ev.clientY - e.clientY) < 5) return;
    if (!moveu) { moveu = true; fant = orig.cloneNode(true); fant.classList.add('fantasmaArraste'); fant.style.width = r.width + 'px'; document.body.append(fant); orig.classList.add('arrastando'); }
    fant.style.left = (ev.clientX - dx) + 'px'; fant.style.top = (ev.clientY - dy) + 'px';
    fant.style.display = 'none';
    const sob = document.elementFromPoint(ev.clientX, ev.clientY)?.closest('.quad');
    fant.style.display = '';
    if (alvo !== sob) { alvo?.classList.remove('alvo'); alvo = sob; alvo?.classList.add('alvo'); }
  };
  const soltar = () => {
    removeEventListener('pointermove', mover); removeEventListener('pointerup', soltar); removeEventListener('pointercancel', soltar);
    fant?.remove(); orig.classList.remove('arrastando'); alvo?.classList.remove('alvo');
    if (moveu && alvo && alvo.dataset.q !== causa.q) enviar({ tipo: 'mover', id: causa.id, q: alvo.dataset.q });
  };
  addEventListener('pointermove', mover); addEventListener('pointerup', soltar); addEventListener('pointercancel', soltar);
}

function renderPraticas() {
  const est = ST.rodadas.praticas;
  const mostra = est === 'revelada';
  const restam = LIM.praticas - totalMeus('praticas');
  $('#meusVotosPraticas').textContent = est === 'aberta' ? (restam ? '1 voto disponível' : 'voto usado') : '';
  $('#estadoPraticas').textContent = est === 'aberta' ? 'Votação aberta. Um voto por pessoa.' : est === 'revelada' ? 'Votação encerrada. As três mais votadas viraram doutrina.' : '';
  const lista = [...ST.praticas.values()];
  if (est === 'revelada') lista.sort((a, b) => (ST.votos.praticas.get(b.id) || 0) - (ST.votos.praticas.get(a.id) || 0));
  const box = $('#praticas');
  if (!lista.length) box.replaceChildren(h('p', { class: 'vazio' }, 'As práticas do time aparecem aqui.'));
  else box.replaceChildren(...lista.map((p) => {
    const meu = ST.meus.praticas.get(p.id) || 0, tot = ST.votos.praticas.get(p.id) || 0;
    return h('div', { class: 'cardLivre' }, p.t,
      (p.cid === CID || SESS.isAdmin) && est !== 'revelada' ? h('button', { class: 'x', type: 'button', 'aria-label': 'Apagar', onclick: () => enviar({ tipo: 'apagar', id: p.id }) }, '×') : null,
      h('div', { class: 'votos' },
        est === 'aberta' ? h('button', { type: 'button', class: meu ? 'on' : null, disabled: (!meu && restam <= 0) || null, onclick: () => enviar({ tipo: 'voto', r: 'praticas', alvo: p.id, v: meu ? -1 : 1 }) }, meu ? 'Votado' : 'Votar') : null,
        mostra && tot ? h('span', { class: 'total' }, tot + (tot === 1 ? ' voto' : ' votos')) : null));
  }));
  const top = est === 'revelada' ? [...ST.praticas.values()].map((p) => [p, ST.votos.praticas.get(p.id) || 0]).filter((x) => x[1] > 0).sort((a, b) => b[1] - a[1]).slice(0, 3) : [];
  const podio = $('#podio');
  const chave = top.map((x) => x[0].id + x[1]).join('|') + est;
  if (podio.dataset.k === chave) return;
  podio.dataset.k = chave;
  podio.replaceChildren(...['I', 'II', 'III'].map((rom, i) => {
    const t = top[i];
    return h('div', { class: 'slot ' + (t ? 'cheio' : 'vazioSlot'), style: t ? 'animation-delay:' + (i * 0.25) + 's' : null },
      h('div', { class: 'rom' }, rom), h('div', { class: 'txt' }, t ? t[0].t : 'Prática que vira padrão no 4T'),
      t ? h('span', { class: 'mono' }, t[1] + (t[1] === 1 ? ' voto' : ' votos')) : h('span'));
  }));
}

function renderAnteriores() {
  $$('#f-06 .estado').forEach((g) => { const v = ST.anteriores[+g.dataset.i] || ''; $$('button', g).forEach((b) => b.classList.toggle('on', b.dataset.v === v)); });
}

function renderOrdens() {
  ST.ordens.forEach((o, n) => {
    for (const f of ['acao', 'dono', 'prazo', 'pronto']) {
      const el = $('#o' + n + f), v = o[f] || '';
      if (document.activeElement !== el && !DEB.has('o' + n + f) && el.value !== v) el.value = v;
    }
    validarPrazo(n, $('#o' + n + 'prazo').value);
    const pronta = !!(o.acao?.trim() && o.dono?.trim() && prazoValido(o.prazo) && o.pronto?.trim());
    const card = $('#ordem-' + n);
    card.classList.toggle('pronta', pronta);
    $('.carimbo', card).textContent = pronta ? 'Pronta para o Jira' : 'Em montagem';
  });
}

function grupos() {
  const g = new Map();
  for (const it of ST.indicados.values()) {
    const k = norm(it.nome);
    if (!k) continue;
    if (!g.has(k)) g.set(k, { k, nome: it.nome, motivos: [], itens: [] });
    const x = g.get(k); x.itens.push(it); if (it.por) x.motivos.push(it.por);
  }
  return [...g.values()];
}
function resultadoMedalha() {
  let gs = grupos();
  if (ST.turno2) gs = gs.filter((g) => ST.turno2.includes(g.k));
  const cont = gs.map((g) => [g, ST.votos.medalha.get(g.k) || 0]).sort((a, b) => b[1] - a[1]);
  if (!cont.length || cont[0][1] === 0) return { vencedores: [], cont };
  const max = cont[0][1];
  return { vencedores: cont.filter((c) => c[1] === max).map((c) => c[0]), cont, max };
}
function renderIndicados() {
  const est = ST.rodadas.medalha;
  const abertos = ST.envelope;
  const meuVoto = [...ST.meus.medalha.entries()].find((x) => x[1] > 0)?.[0];
  $('#estadoMedalha').textContent = ST.turno2 ? 'segundo turno' : est === 'aberta' ? 'votação aberta' : est === 'revelada' ? 'votação encerrada' : '';
  let gs = grupos();
  if (ST.turno2) gs = gs.filter((g) => ST.turno2.includes(g.k));
  const box = $('#indicados');
  if (!gs.length) { box.replaceChildren(h('p', { class: 'vazio' }, 'As indicações aparecem aqui. Elogio vai com nome.')); return; }
  const res = ST.envelope ? resultadoMedalha() : null;
  box.replaceChildren(...gs.map((g) => {
    const tot = ST.votos.medalha.get(g.k) || 0;
    const minhas = g.itens.filter((it) => it.cid === CID || SESS.isAdmin);
    return h('div', { class: 'indicado' + (res && res.vencedores.includes(g) ? ' escolhido' : '') },
      h('div', { class: 'nome' }, g.nome, abertos && tot ? h('span', { class: 'total' }, tot + (tot === 1 ? ' voto' : ' votos')) : null),
      g.motivos.length ? h('ul', null, g.motivos.map((m) => h('li', null, m))) : null,
      h('div', { class: 'votar', style: 'display:flex;gap:8px;flex-wrap:wrap' },
        est === 'aberta' ? h('button', { class: 'btn mini ' + (meuVoto === g.k ? 'ouro' : 'fantasma'), type: 'button', onclick: () => votarMedalha(g.k, meuVoto) }, meuVoto === g.k ? 'Seu voto' : 'Votar') : null,
        est !== 'aberta' && !ST.envelope ? minhas.map((it) => h('button', { class: 'btn mini fantasma', type: 'button', onclick: () => enviar({ tipo: 'apagar', id: it.id }) }, 'Apagar minha indicação')) : null));
  }));
}
async function votarMedalha(k, atual) {
  if (atual === k) return enviar({ tipo: 'voto', r: 'medalha', alvo: k, v: -1 });
  if (atual) await enviar({ tipo: 'voto', r: 'medalha', alvo: atual, v: -1 });
  enviar({ tipo: 'voto', r: 'medalha', alvo: k, v: 1 });
}

function renderEnvelope() {
  const env = $('#envelope'), bil = $('#bilhete');
  env.classList.toggle('aberto', ST.envelope);
  if (ST.envelope) {
    const r = resultadoMedalha();
    let txt;
    if (r.vencedores.length === 1) txt = [h('div', { class: 'mono', style: 'color:#7a5c1f' }, 'Medalha Tridente'), h('b', null, r.vencedores[0].nome)];
    else if (r.vencedores.length > 1) txt = [h('div', { class: 'mono', style: 'color:#7a5c1f' }, 'Empate'), h('b', { style: 'font-size:20px' }, r.vencedores.map((g) => g.nome).join(' e '))];
    else txt = [h('b', { style: 'font-size:20px' }, 'Sem votos ainda')];
    bil.replaceChildren(...txt);
    if (!envelopeVisto && r.vencedores.length === 1) { envelopeVisto = true; if (!primeiro) faiscas(); }
  } else { envelopeVisto = false; bil.replaceChildren(h('b', null, 'Medalha Tridente')); }
}

function renderNuvem() {
  const cont = new Map();
  for (const w of ST.palavras.values()) cont.set(w, (cont.get(w) || 0) + 1);
  const lista = [...cont.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 40);
  $('#totPalavras').textContent = ST.palavras.size ? ST.palavras.size + (ST.palavras.size === 1 ? ' pessoa' : ' pessoas') : '';
  const box = $('#nuvem');
  if (!lista.length) { box.replaceChildren(h('p', { class: 'vazio', style: 'position:absolute;inset:0;display:grid;place-items:center;margin:0' }, 'A nuvem cresce com as palavras do time.')); return; }
  const max = lista[0][1];
  const CORES = ['#e2c579', '#ffffff', '#8caee2', '#2280ec', '#d3e2f2', '#0099ff'];
  const W = box.clientWidth || 800, H = box.clientHeight || 260;
  const postos = [];
  const atuais = new Map($$('span[data-w]', box).map((sp) => [sp.dataset.w, sp]));
  const novos = [];
  lista.forEach(([w, n], i) => {
    let tam = 16 + Math.round((n / max) * 44);
    let lugar = null;
    for (let tent = 0; tent < 3 && !lugar; tent++, tam = Math.max(14, Math.round(tam * 0.8))) {
      const lw = w.length * tam * 0.56 + 14, lh = tam * 1.15;
      for (let t = 0; t < 60; t += 0.25) {
        const x = W / 2 + 6 * t * Math.cos(t) * 1.5, y = H / 2 + 6 * t * Math.sin(t) * 0.75;
        const r = { x: x - lw / 2, y: y - lh / 2, w: lw, h: lh };
        if (r.x < 6 || r.y < 6 || r.x + r.w > W - 6 || r.y + r.h > H - 6) continue;
        if (postos.some((o) => r.x < o.x + o.w && r.x + r.w > o.x && r.y < o.y + o.h && r.y + r.h > o.y)) continue;
        lugar = { x, y, r }; break;
      }
    }
    if (!lugar) return;
    postos.push(lugar.r);
    const el = atuais.get(w) || h('span', { dataset: { w } }, w);
    el.style.cssText = 'left:' + lugar.x.toFixed(0) + 'px;top:' + lugar.y.toFixed(0) + 'px;font-size:' + tam + 'px;color:' + (i === 0 ? CORES[0] : CORES[1 + (i % 5)]) + ';animation-delay:' + (i * 0.3 % 6).toFixed(1) + 's';
    novos.push(el);
  });
  box.replaceChildren(...novos);
}

function renderHooyah() {
  const vivo = ST.fim || ST.envelope;
  $('#hooyah').classList.toggle('vivo', vivo);
}

/* faíscas douradas na revelação */
function faiscas() {
  if (reduzMov) return;
  const cv = $('#faiscas'), ctx = cv.getContext('2d');
  cv.width = innerWidth * devicePixelRatio; cv.height = innerHeight * devicePixelRatio; ctx.scale(devicePixelRatio, devicePixelRatio);
  const env = $('#envelope').getBoundingClientRect();
  const ox = env.left + env.width / 2, oy = env.top + 40;
  const P = Array.from({ length: 140 }, () => { const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.2, v = 3 + Math.random() * 7; return { x: ox, y: oy, vx: Math.cos(a) * v, vy: Math.sin(a) * v, r: 1 + Math.random() * 2.5, vida: 1, c: Math.random() < 0.7 ? '#e2c579' : '#fff1c4' }; });
  let t0 = performance.now();
  (function quadro(t) {
    const dt = Math.min(2, (t - t0) / 16.7); t0 = t;
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    let vivos = 0;
    for (const p of P) {
      if (p.vida <= 0) continue; vivos++;
      p.vy += 0.12 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vida -= 0.009 * dt;
      ctx.globalAlpha = Math.max(0, p.vida); ctx.fillStyle = p.c; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.283); ctx.fill();
    }
    if (vivos) requestAnimationFrame(quadro); else ctx.clearRect(0, 0, innerWidth, innerHeight);
  })(t0);
}

/* ============ animações de entrada ============ */
function observarSurgir() {
  const io = new IntersectionObserver((ents) => ents.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('visivel'); io.unobserve(en.target); } }), { threshold: 0.12 });
  $$('.surge').forEach((el) => io.observe(el));
  $$('.linhaMissao').forEach((el, i) => { el.style.transitionDelay = (i * 0.08) + 's'; });
}
function contarNumeros() {
  const io = new IntersectionObserver((ents) => ents.forEach((en) => {
    if (!en.isIntersecting) return; io.unobserve(en.target);
    const el = en.target, alvo = el.dataset.alvo, m = alvo.match(/^(\d+)(.*)$/);
    if (!m || reduzMov) return;
    const fim = +m[1], suf = m[2], t0 = performance.now(), dur = 1400;
    (function passo(t) { const p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 3); el.textContent = Math.round(fim * e) + suf; if (p < 1) requestAnimationFrame(passo); })(t0);
  }), { threshold: 0.4 });
  $$('.numero b').forEach((b) => io.observe(b));
}

/* debounce com rastreio de campos em edição */
const DEB = new Map();
function debounce(k, fn, ms) { clearTimeout(DEB.get(k)); DEB.set(k, setTimeout(() => { DEB.delete(k); fn(); }, ms)); }
function cancelDebounce(k) { clearTimeout(DEB.get(k)); DEB.delete(k); }

function novoFato() {
  const i = $('#txtFato'), t = i.value.trim();
  if (!t) return;
  const cor = $('#corFato .sel')?.dataset.c || 'verde';
  enviar({ tipo: 'fato', id: uid(), mes: $('#mesFato').value, cor, t });
  i.value = ''; i.focus();
}

/* ============ QG do mediador ============ */
function montarQG() {
  const qg = $('#qg'); qg.hidden = false;
  document.body.classList.add('mediador');
  $('header', qg).addEventListener('click', () => { qg.classList.toggle('fechado'); document.body.classList.toggle('qgFechado', qg.classList.contains('fechado')); $('header .mono', qg).textContent = qg.classList.contains('fechado') ? 'abrir' : 'recolher'; renderBarra(); });
  const corpo = $('.corpoQG', qg);
  const btn = (txt, fn, cls = 'fantasma') => h('button', { class: 'btn ' + cls, type: 'button', onclick: fn }, txt);
  corpo.replaceChildren(
    h('div', { class: 'grupo' }, h('span', { class: 'mono' }, 'Parada atual'), h('div', { class: 'faseAtual', id: 'qgFase' }),
      h('div', { class: 'linhaBtns' }, btn('Anterior', () => passoFase(-1)), btn('Próxima parada', () => passoFase(1), ''), btn('Encerrar AAR', () => enviar({ tipo: 'fim' }), 'ouro')),
      h('div', { class: 'linhaBtns', style: 'margin-top:8px' }, C.fases.map((f) => btn(f.id, () => irFase(f.id), 'mini fantasma'))),
      h('label', { class: 'check', style: 'font-size:13px' }, h('input', { type: 'checkbox', id: 'qgAuto', checked: true }), 'Iniciar o timer ao trocar de parada')),
    h('div', { class: 'grupo' }, h('span', { class: 'mono' }, 'Timer'),
      h('div', { class: 'linhaBtns' }, btn('Iniciar timer da parada', () => iniciarTimer(), ''), btn('+1 min', () => maisUm()), btn('Parar', () => enviar({ tipo: 'timer', fim: 0, dur: 0 })))),
    h('div', { class: 'grupo', id: 'qg02' }, h('span', { class: 'mono' }, '02  ·  cartas do validador'),
      h('div', { class: 'linhaBtns' }, btn('Virar a próxima carta', virarProxima, ''), btn('Desvirar todas', () => enviar({ tipo: 'desvirar' })))),
    h('div', { class: 'grupo', id: 'qg03' }, h('span', { class: 'mono' }, '03  ·  escrita em silêncio'),
      h('div', { class: 'linhaBtns' }, h('button', { class: 'btn', type: 'button', id: 'qgPriv', onclick: () => enviar({ tipo: 'privado', on: !ST.privado }) }))),
    h('div', { class: 'grupo', id: 'qg04' }, h('span', { class: 'mono' }, '04  ·  votação nos fatos'), h('div', { class: 'linhaBtns', id: 'qgRodFatos' })),
    h('div', { class: 'grupo', id: 'qg05' }, h('span', { class: 'mono' }, '05  ·  votação das práticas'), h('div', { class: 'linhaBtns', id: 'qgRodPraticas' })),
    h('div', { class: 'grupo', id: 'qg07' }, h('span', { class: 'mono' }, '07  ·  medalha e envelope'), h('div', { class: 'linhaBtns', id: 'qgRodMedalha' })),
    h('div', { class: 'grupo' }, h('details', { id: 'qgPlacarBox' }, h('summary', null, 'Placar parcial (cuidado ao compartilhar a tela)'), h('ul', { id: 'qgPlacar' }))),
    h('div', { class: 'grupo' }, h('span', { class: 'mono' }, 'Plano de voo  ·  planejado x real'), h('table', null, h('thead', null, h('tr', null, h('th', null, 'Parada'), h('th', null, 'Plano'), h('th', null, 'Real'))), h('tbody', { id: 'qgVoo' }))),
    h('div', { class: 'grupo' }, h('span', { class: 'mono' }, 'Resultado e dados'),
      h('div', { class: 'linhaBtns' }, btn('Planilha para o Jira (CSV)', baixarCSV, ''), btn('Resultado completo (JSON)', baixarJSON), btn('Copiar resumo', copiarResumo)),
      h('div', { class: 'linhaBtns', style: 'margin-top:10px' }, btn('Apagar todos os dados da sala', apagarSala, 'perigo'))));
}
function irFase(id) {
  enviar({ tipo: 'fase', p: id });
  if ($('#qgAuto')?.checked) iniciarTimer(id);
}
function passoFase(d) {
  const i = ST.fase ? C.fases.findIndex((f) => f.id === ST.fase) : -1;
  const n = Math.max(0, Math.min(C.fases.length - 1, i + d));
  irFase(C.fases[n].id);
}
function iniciarTimer(id) {
  const f = fase(id || ST.fase || '01');
  const dur = f.min * 60000;
  enviar({ tipo: 'timer', fim: agora() + dur, dur });
}
function maisUm() {
  if (!ST.timer.fim) return iniciarTimer();
  const base = Math.max(ST.timer.fim, agora());
  enviar({ tipo: 'timer', fim: base + 60000, dur: ST.timer.dur + 60000 });
}
function virarProxima() {
  for (let i = 0; i < C.validador.length; i++) if (!ST.flips.has(i)) return enviar({ tipo: 'virar', i, on: true });
  toast('Todas as cartas já estão viradas.');
}
function botoesRodada(box, r, rotAbrir, rotFechar) {
  const est = ST.rodadas[r];
  const b = [];
  if (est !== 'aberta') b.push(h('button', { class: 'btn', type: 'button', onclick: () => enviar({ tipo: 'rodada', r, estado: 'aberta', zerar: est === 'fechada' }) }, est === 'fechada' ? rotAbrir : 'Reabrir votação'));
  if (est === 'aberta') b.push(h('button', { class: 'btn', type: 'button', onclick: () => enviar({ tipo: 'rodada', r, estado: 'revelada' }) }, rotFechar));
  if (est !== 'fechada') b.push(h('button', { class: 'btn fantasma', type: 'button', onclick: () => { if (confirm('Zerar os votos desta rodada?')) enviar({ tipo: 'rodada', r, estado: 'fechada', zerar: true }); } }, 'Zerar'));
  box.replaceChildren(...b);
}
function renderQG() {
  const f = ST.fase ? fase(ST.fase) : null;
  $('#qgFase').textContent = ST.fim ? 'AAR encerrado' : f ? f.id + '  ·  ' + f.titulo : 'Ainda não começou';
  $('#qgPriv').textContent = ST.privado ? 'Revelar a escrita' : 'Ligar o modo privado';
  $('#qgPriv').className = 'btn' + (ST.privado ? ' ouro' : '');
  botoesRodada($('#qgRodFatos'), 'fatos', 'Abrir votação', 'Encerrar e revelar');
  botoesRodada($('#qgRodPraticas'), 'praticas', 'Abrir votação', 'Encerrar e revelar');
  const box = $('#qgRodMedalha');
  botoesRodada(box, 'medalha', 'Abrir votação da medalha', 'Encerrar votação');
  const res = resultadoMedalha();
  if (ST.rodadas.medalha === 'revelada' || ST.envelope) box.append(h('button', { class: 'btn ouro', type: 'button', onclick: () => enviar({ tipo: 'envelope', on: !ST.envelope }) }, ST.envelope ? 'Fechar envelope' : 'Abrir envelope'));
  if (ST.envelope && res.vencedores.length > 1) box.append(h('button', { class: 'btn', type: 'button', onclick: () => { enviar({ tipo: 'turno2', nomes: res.vencedores.map((g) => g.k) }); enviar({ tipo: 'rodada', r: 'medalha', estado: 'aberta' }); } }, 'Segundo turno'));
  const top3 = (r, mapa, rot) => [...mapa.values()].map((x) => [rot(x), ST.votos[r].get(x.id) || 0]).filter((x) => x[1]).sort((a, b) => b[1] - a[1]).slice(0, 3);
  const itens = [];
  for (const [t, n] of top3('fatos', ST.fatos, (f) => f.t)) itens.push('Fato: ' + t + ' (' + n + ')');
  for (const [t, n] of top3('praticas', ST.praticas, (p) => p.t)) itens.push('Prática: ' + t + ' (' + n + ')');
  for (const [g, n] of res.cont) if (n) itens.push('Medalha: ' + g.nome + ' (' + n + ')');
  $('#qgPlacar').replaceChildren(...(itens.length ? itens.map((t) => h('li', null, t)) : [h('li', null, 'Sem votos ainda.')]));
  for (const id of ['02', '03', '04', '05', '07']) { const g = $('#qg' + id); if (g) g.style.borderColor = ST.fase === id ? 'var(--gold)' : ''; }
}
function temposReais() {
  const real = {};
  const log = ST.log;
  for (let i = 0; i < log.length; i++) {
    if (log[i].p === 'fim') continue;
    const fimT = i + 1 < log.length ? log[i + 1].ts : (ST.fim ? log[i].ts : agora());
    real[log[i].p] = (real[log[i].p] || 0) + Math.max(0, fimT - log[i].ts);
  }
  return real;
}
function atualizarPlanoVoo() {
  const tb = $('#qgVoo'); if (!tb) return;
  const real = temposReais();
  let tp = 0, tr = 0;
  const linhas = C.fases.map((f) => { const r = real[f.id] || 0; tp += f.min; tr += r; return h('tr', null, h('td', null, f.id + ' ' + f.rota), h('td', null, pad(f.min) + ':00'), h('td', { class: r > f.min * 60000 ? 'estouro' : null }, r ? mmss(r) : '')); });
  linhas.push(h('tr', null, h('th', null, 'Total'), h('th', null, tp + ':00'), h('th', { class: tr > tp * 60000 ? 'estouro' : null }, tr ? mmss(tr) : '')));
  tb.replaceChildren(...linhas);
}

/* exportações */
function baixar(nome, tipo, conteudo) {
  const url = URL.createObjectURL(new Blob([conteudo], { type: tipo }));
  const a = h('a', { href: url, download: nome }); document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
const csvCel = (v) => '"' + String(v ?? '').replace(/"/g, '""') + '"';
function baixarCSV() {
  const j = C.jira || {};
  const linhas = [['Summary', 'Description', 'Issue Type', 'Due Date', 'Labels', 'Dono']];
  ST.ordens.forEach((o, n) => {
    if (!o.acao?.trim()) return;
    linhas.push([o.acao.trim(), 'Compromisso de combate ' + ['I', 'II', 'III'][n] + ' do AAR.\nDono: ' + (o.dono || '') + '\nPronto quando: ' + (o.pronto || ''), j.tipo || 'Task', o.prazo || '', j.rotulo || 'aar', o.dono || '']);
  });
  if (linhas.length === 1) return toast('Nenhum compromisso preenchido ainda.');
  baixar('compromissos-de-combate.csv', 'text/csv;charset=utf-8', '﻿' + linhas.map((l) => l.map(csvCel).join(',')).join('\r\n'));
}
function resultado() {
  const fatos = [...ST.fatos.values()].map((f) => ({ mes: f.mes, tipo: f.cor, fato: f.t, votos: ST.votos.fatos.get(f.id) || 0 }));
  const praticas = [...ST.praticas.values()].map((p) => ({ pratica: p.t, votos: ST.votos.praticas.get(p.id) || 0 })).sort((a, b) => b.votos - a.votos);
  const med = resultadoMedalha();
  const cont = [0, 0, 0, 0, 0]; for (const n of ST.prontidao.values()) cont[n - 1]++;
  const real = temposReais();
  return {
    sala: C.sala, exportadoEm: new Date(agora()).toISOString(),
    prontidao: C.abertura.prontidao.map((t, i) => ({ nivel: i + 1, descricao: t, pessoas: cont[i] })),
    fatos, porques: ST.porques,
    causas: [...ST.causas.values()].map((c) => ({ causa: c.t, quadrante: { ca: 'controlável, impacto alto', ia: 'incontrolável, impacto alto', cb: 'controlável, impacto baixo', ib: 'incontrolável, impacto baixo' }[c.q] })),
    doutrina: praticas.filter((p) => p.votos > 0).slice(0, 3), praticas,
    compromissosAnteriores: C.compromissosAnteriores.map((c, i) => ({ compromisso: c.t, situacao: ST.anteriores[i] || 'a confirmar' })),
    compromissosDeCombate: ST.ordens.map((o, n) => ({ ordem: ['I', 'II', 'III'][n], acao: o.acao || '', dono: o.dono || '', prazo: o.prazo || '', prontoQuando: o.pronto || '' })),
    medalha: { vencedores: med.vencedores.map((g) => g.nome), placar: med.cont.map(([g, n]) => ({ nome: g.nome, votos: n, motivos: g.motivos })) },
    palavras: [...ST.palavras.values()],
    planoDeVoo: C.fases.map((f) => ({ parada: f.id + ' ' + f.rota, planejadoMin: f.min, realMin: real[f.id] ? +(real[f.id] / 60000).toFixed(1) : null })),
  };
}
function baixarJSON() { baixar('resultado-aar.json', 'application/json', JSON.stringify(resultado(), null, 2)); }
function copiarResumo() {
  const r = resultado();
  const l = [];
  l.push(r.sala, '');
  l.push('Doutrina (o que fica):'); r.doutrina.forEach((p, i) => l.push('  ' + ['I', 'II', 'III'][i] + '. ' + p.pratica + ' (' + p.votos + ')'));
  l.push('', 'Árvore dos 5 porquês:'); r.porques.forEach((p, i) => p && l.push('  ' + (i === 0 ? 'Problema' : i === 5 ? 'Causa raiz' : i + 'º por quê') + ': ' + p));
  l.push('', 'Compromissos de combate:'); r.compromissosDeCombate.forEach((o) => o.acao && l.push('  ' + o.ordem + '. ' + o.acao + ' | dono: ' + o.dono + ' | prazo: ' + o.prazo + ' | pronto quando: ' + o.prontoQuando));
  l.push('', 'Medalha Tridente: ' + (r.medalha.vencedores.join(' e ') || 'sem votos'));
  navigator.clipboard?.writeText(l.join('\n')).then(() => toast('Resumo copiado.'), () => toast('Não consegui copiar. Use o JSON.'));
}
async function apagarSala() {
  const ok = prompt('Isso apaga a sala, o conteúdo cifrado e tudo o que o time escreveu. Baixe o resultado antes. Para confirmar, digite APAGAR');
  if (ok !== 'APAGAR') return;
  try { await chamar('POST', '/api/reset', {}); limparSessao(); location.reload(); } catch (e) { toast(e.message); }
}

iniciar();
})();
