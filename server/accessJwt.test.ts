import { beforeAll, describe, expect, it } from 'vitest';
import { verifyAccessJwt, type AccessJwk, type AccessJwtCheck } from './accessJwt';

const ISSUER = 'https://time.cloudflareaccess.com';
const AUD = 'aud-tag';
const NOW = 1_800_000_000;

const b64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const encodeJson = (data: unknown) => b64url(new TextEncoder().encode(JSON.stringify(data)));

let keyPair: CryptoKeyPair;
let publicJwk: AccessJwk;

beforeAll(async () => {
  keyPair = (await crypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true,
    ['sign', 'verify'],
  )) as CryptoKeyPair;
  publicJwk = { ...((await crypto.subtle.exportKey('jwk', keyPair.publicKey)) as JsonWebKey), kid: 'k1' };
});

async function sign(payload: Record<string, unknown>, header: Record<string, unknown> = { alg: 'RS256', kid: 'k1' }) {
  const body = `${encodeJson(header)}.${encodeJson(payload)}`;
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', keyPair.privateKey, new TextEncoder().encode(body));
  return `${body}.${b64url(new Uint8Array(signature))}`;
}

const valid = { iss: ISSUER, aud: [AUD], email: 'Admin@Example.com', exp: NOW + 600, nbf: NOW - 10 };
const check = (keys: AccessJwk[] = [publicJwk]): AccessJwtCheck => ({ issuer: ISSUER, audience: AUD, keys: async () => keys, now: NOW });

describe('verifyAccessJwt', () => {
  it('aceita um token válido e devolve o e-mail em minúsculas', async () => {
    expect(await verifyAccessJwt(await sign(valid), check())).toBe('admin@example.com');
  });

  it('recusa aud, iss, prazo ou assinatura errados', async () => {
    expect(await verifyAccessJwt(await sign({ ...valid, aud: ['outra'] }), check())).toBeNull();
    expect(await verifyAccessJwt(await sign({ ...valid, iss: 'https://outro.cloudflareaccess.com' }), check())).toBeNull();
    expect(await verifyAccessJwt(await sign({ ...valid, exp: NOW - 120 }), check())).toBeNull();
    expect(await verifyAccessJwt(await sign({ ...valid, nbf: NOW + 120 }), check())).toBeNull();
    const [h, , s] = (await sign(valid)).split('.');
    expect(await verifyAccessJwt(`${h}.${encodeJson({ ...valid, email: 'hacker@x.com' })}.${s}`, check())).toBeNull();
  });

  it('recusa alg diferente de RS256 e lixo', async () => {
    expect(await verifyAccessJwt(await sign(valid, { alg: 'none', kid: 'k1' }), check())).toBeNull();
    expect(await verifyAccessJwt('a.b', check())).toBeNull();
    expect(await verifyAccessJwt('###.###.###', check())).toBeNull();
  });

  it('chave desconhecida: busca de novo (rotação) antes de recusar', async () => {
    const calls: boolean[] = [];
    const rotating: AccessJwtCheck = {
      ...check(),
      keys: async (refresh) => {
        calls.push(refresh);
        return refresh ? [publicJwk] : [];
      },
    };
    expect(await verifyAccessJwt(await sign(valid), rotating)).toBe('admin@example.com');
    expect(calls).toEqual([false, true]);
    expect(await verifyAccessJwt(await sign(valid), check([]))).toBeNull();
  });
});
