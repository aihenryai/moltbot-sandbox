import { Hono } from 'hono';
import type { AppEnv } from '../types';

const adminUi = new Hono<AppEnv>();

adminUi.get('*', async (c) => {
  const url = new URL(c.req.url);
  return c.env.ASSETS.fetch(new Request(new URL('/index.html', url.origin).toString()));
});

export { adminUi };
