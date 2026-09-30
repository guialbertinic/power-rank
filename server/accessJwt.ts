/**
 * Verificação do JWT que o Cloudflare Access coloca em `Cf-Access-Jwt-Assertion` em toda requisição que passou
 * pelo login dele. Sem dependências: WebCrypto (RS256) e as chaves públicas do time
 * (`https://<time>.cloudflareaccess.com/cdn-cgi/access/certs`).
 */

export interface AccessJwk extends JsonWebKey {
  kid: string;
}

export interface AccessJwtCheck {
  /** URL do time, ex: https://meutime.cloudflareaccess.com (é o `iss` do token). */
  issuer: string;
  /** "Application Audience (AUD) Tag" da aplicação no Access. */
  audience: string;
  /** Busca as chaves; `refresh` = ignorar o cache (chave nova depois de uma rotação). */
  keys: (refresh: boolean) => Promise<AccessJwk[]>;
  /** Agora, em segundos (para os testes). */
  now?: number;
}

/** Folga para relógios um pouco diferentes. */
const CLOCK_SKEW_S = 60;

function base64UrlBytes(value: string): Uint8Array {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')), (c) => c.charCodeAt(0));
}

function decodePart(value: string): Record<string, unknown> | null {
  try {
    const data = JSON.parse(new TextDecoder().decode(base64UrlBytes(value)));
    return data && typeof data === 'object' ? data : null;
  } catch {
    return null;
  }
}

/** E-mail (minúsculo) de quem fez login no Access, ou null se o token não vale. */
export async function verifyAccessJwt(token: string, check: AccessJwtCheck): Promise<string | null> {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [headerPart, payloadPart, signaturePart] = parts;
  const header = decodePart(headerPart);
  const payload = decodePart(payloadPart);
  if (!header || !payload || header.alg !== 'RS256' || typeof header.kid !== 'string') return null;

  let key = (await check.keys(false)).find((k) => k.kid === header.kid);
  if (!key) key = (await check.keys(true)).find((k) => k.kid === header.kid);
  if (!key) return null;

  const { kty, n, e } = key;
  const cryptoKey = await crypto.subtle.importKey(
    'jwk',
    { kty, n, e, alg: 'RS256', ext: true },
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify'],
  );
  const valid = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    base64UrlBytes(signaturePart),
    new TextEncoder().encode(`${headerPart}.${payloadPart}`),
  );
  if (!valid) return null;

  const now = check.now ?? Date.now() / 1000;
  const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (payload.iss !== check.issuer.replace(/\/+$/, '')) return null;
  if (!audiences.includes(check.audience)) return null;
  if (typeof payload.exp !== 'number' || payload.exp + CLOCK_SKEW_S < now) return null;
  if (typeof payload.nbf === 'number' && payload.nbf - CLOCK_SKEW_S > now) return null;
  return typeof payload.email === 'string' && payload.email ? payload.email.toLowerCase() : null;
}
