import { HttpError } from './db';

const baseHeaders = { 'Cache-Control': 'private, no-store', Vary: 'Cookie' };

export const out = (data: unknown, status = 200, extra: Record<string, string> = {}) =>
  Response.json(data, { status, headers: { ...baseHeaders, ...extra } });

export const fail = (status: number, message: string): never => {
  throw new HttpError(status, message);
};

export function cookie(req: Request, name: string) {
  return req.headers.get('cookie')?.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`))?.[1];
}

export function setCookie(name: string, value: string, maxAge: number, req: Request) {
  const secure = new URL(req.url).protocol === 'https:' ? ' Secure;' : '';
  return `${name}=${value}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge};${secure}`;
}

export function clientIp(req: Request) {
  return req.headers.get('cf-connecting-ip') || req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
}

export function sameOrigin(req: Request) {
  const origin = req.headers.get('origin');
  return !origin || origin === new URL(req.url).origin;
}

export function siteUrl(req: Request) {
  return new URL(req.url).origin;
}

export const str = (v: unknown, max = 500) => String(v ?? '').trim().slice(0, max);
export const num = (v: unknown, fallback = 0) => (Number.isFinite(Number(v)) ? Number(v) : fallback);
export const bool = (v: unknown) => (v === true || v === 1 || v === '1' || v === 'true' || v === 'on' ? 1 : 0);
