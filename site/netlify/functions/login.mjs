import { createHmac, timingSafeEqual } from 'node:crypto'

const user = () => process.env.ESTUDO_USER || ''
const pass = () => process.env.ESTUDO_PASS || ''
const secret = () => process.env.ESTUDO_SECRET || pass() || 'estudo-local'

function igual(a, b) {
  const ba = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ba.length !== bb.length) return false
  return timingSafeEqual(ba, bb)
}

function token(expira) {
  const corpo = `ok.${expira}`
  const sig = createHmac('sha256', secret()).update(corpo).digest('base64url')
  return `${corpo}.${sig}`
}

function valido(t) {
  if (!t) return false
  const partes = t.split('.')
  if (partes.length !== 3 || partes[0] !== 'ok') return false
  const expira = Number(partes[1])
  if (!Number.isFinite(expira) || Date.now() > expira) return false
  return igual(t, token(expira))
}

const cookie = (valor, maxAge) =>
  `estudo_sessao=${valor}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`

export async function handler(event) {
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  }
  if (event.httpMethod === 'GET') {
    const raw = event.headers.cookie || event.headers.Cookie || ''
    const m = /(?:^|;\s*)estudo_sessao=([^;]+)/.exec(raw)
    const ok = valido(m?.[1])
    return { statusCode: ok ? 200 : 401, headers, body: JSON.stringify({ ok }) }
  }
  if (event.httpMethod === 'DELETE') {
    return {
      statusCode: 200,
      headers: { ...headers, 'Set-Cookie': cookie('', 0) },
      body: JSON.stringify({ ok: false }),
    }
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ ok: false }) }
  }
  let body = {}
  try {
    body = JSON.parse(event.body || '{}')
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ ok: false }) }
  }
  const u = user()
  const p = pass()
  if (!u || !p || !igual((body.user || '').trim(), u) || !igual(body.pass || '', p)) {
    return { statusCode: 401, headers, body: JSON.stringify({ ok: false }) }
  }
  const expira = Date.now() + 7 * 24 * 3600 * 1000
  return {
    statusCode: 200,
    headers: { ...headers, 'Set-Cookie': cookie(token(expira), 7 * 24 * 3600) },
    body: JSON.stringify({ ok: true }),
  }
}
