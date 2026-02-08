import type { Context, Next } from 'hono';
import type { AppEnv, MoltbotEnv } from '../types';
import { verifyAccessJWT } from './jwt';

export interface AccessMiddlewareOptions {
  type: 'json' | 'html';
  redirectOnMissing?: boolean;
}

export function isDevMode(env: MoltbotEnv): boolean {
  return env.DEV_MODE === 'true';
}

export function isE2ETestMode(env: MoltbotEnv): boolean {
  return env.E2E_TEST_MODE === 'true';
}

export function extractJWT(c: Context<AppEnv>): string | null {
  const jwtHeader = c.req.header('CF-Access-JWT-Assertion');
  const jwtCookie = c.req.raw.headers
    .get('Cookie')
    ?.split(';')
    .find((cookie) => cookie.trim().startsWith('CF_Authorization='))
    ?.split('=')[1];

  return jwtHeader || jwtCookie || null;
}

export function createAccessMiddleware(options: AccessMiddlewareOptions) {
  const { type, redirectOnMissing = false } = options;

  return async (c: Context<AppEnv>, next: Next) => {
    if (isDevMode(c.env) || isE2ETestMode(c.env)) {
      c.set('accessUser', { email: 'dev@localhost', name: 'Dev User' });
      return next();
    }

    const teamDomain = c.env.CF_ACCESS_TEAM_DOMAIN;
    const expectedAud = c.env.CF_ACCESS_AUD;

    if (!teamDomain || !expectedAud) {
      if (type === 'json') {
        return c.json(
          { error: 'Cloudflare Access not configured', hint: 'Set CF_ACCESS_TEAM_DOMAIN and CF_ACCESS_AUD environment variables' },
          500,
        );
      } else {
        return c.html('<html><body><h1>Admin UI Not Configured</h1><p>Set CF_ACCESS_TEAM_DOMAIN and CF_ACCESS_AUD environment variables.</p></body></html>', 500);
      }
    }

    const jwt = extractJWT(c);

    if (!jwt) {
      if (type === 'html' && redirectOnMissing) {
        return c.redirect(`https://${teamDomain}`, 302);
      }
      if (type === 'json') {
        return c.json({ error: 'Unauthorized', hint: 'Missing Cloudflare Access JWT.' }, 401);
      } else {
        return c.html(`<html><body><h1>Unauthorized</h1><p>Missing Cloudflare Access token.</p><a href="https://${teamDomain}">Login</a></body></html>`, 401);
      }
    }

    try {
      const payload = await verifyAccessJWT(jwt, teamDomain, expectedAud);
      c.set('accessUser', { email: payload.email, name: payload.name });
      await next();
    } catch (err) {
      console.error('Access JWT verification failed:', err);
      if (type === 'json') {
        return c.json({ error: 'Unauthorized', details: err instanceof Error ? err.message : 'JWT verification failed' }, 401);
      } else {
        return c.html(`<html><body><h1>Unauthorized</h1><p>Your Cloudflare Access session is invalid or expired.</p><a href="https://${teamDomain}">Login again</a></body></html>`, 401);
      }
    }
  };
}
