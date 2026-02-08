import { jwtVerify, createRemoteJWKSet } from 'jose';
import type { JWTPayload } from '../types';

export async function verifyAccessJWT(
  token: string,
  teamDomain: string,
  expectedAud: string,
): Promise<JWTPayload> {
  const issuer = teamDomain.startsWith('https://') ? teamDomain : `https://${teamDomain}`;
  const JWKS = createRemoteJWKSet(new URL(`${issuer}/cdn-cgi/access/certs`));
  const { payload } = await jwtVerify(token, JWKS, {
    issuer,
    audience: expectedAud,
  });
  return payload as unknown as JWTPayload;
}
