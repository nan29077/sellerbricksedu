import { all, first, run, batch, stmt, now, uid, HttpError } from './db';
import { cookie, setCookie, clientIp } from './http';

export const SESSION_COOKIE = 'edu_session';
const SESSION_DAYS = 14;
const SESSION_MS = SESSION_DAYS * 86400000;

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: 'student' | 'admin' | 'manager';
  status: string;
  created: string;
  avatar: number;
  name_changes: number;
  weekly_goal: number;
  bio: string;
  has_password: number;
};

export async function hash(password: string, salt: string) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: new TextEncoder().encode(salt), iterations: 100000, hash: 'SHA-256' }, key, 256);
  return Array.from(new Uint8Array(bits)).map((x) => x.toString(16).padStart(2, '0')).join('');
}
export async function encodePassword(password: string) {
  const salt = uid();
  return salt + ':' + (await hash(password, salt));
}
export async function verifyPassword(stored: string | null | undefined, password: string) {
  if (!stored) return false;
  const [salt, pw] = stored.split(':');
  return (await hash(password, salt)) === pw;
}

export function sessionToken(req: Request) {
  return cookie(req, SESSION_COOKIE) || '';
}

export async function current(req: Request): Promise<SessionUser | null> {
  const token = sessionToken(req);
  if (!token) return null;
  const user = await first<SessionUser & { expires: number }>(
    `SELECT users.id,users.email,users.name,users.role,users.status,users.created,
            COALESCE(user_profiles.avatar,0) AS avatar,COALESCE(user_profiles.name_changes,0) AS name_changes,
            COALESCE(user_profiles.weekly_goal,3) AS weekly_goal,COALESCE(user_profiles.bio,'') AS bio,
            CASE WHEN users.password IS NULL THEN 0 ELSE 1 END AS has_password, sessions.expires
     FROM sessions JOIN users ON users.id=sessions.user_id LEFT JOIN user_profiles ON user_profiles.user_id=users.id
     WHERE sessions.id=? AND sessions.expires>? AND users.status='active'`,
    token,
    Date.now(),
  );
  if (!user) return null;
  // 슬라이딩 만료: 남은 기간이 절반 이하면 연장
  if (user.expires - Date.now() < SESSION_MS / 2) {
    await run('UPDATE sessions SET expires=? WHERE id=?', Date.now() + SESSION_MS, token).catch(() => {});
  }
  const { expires: _e, ...rest } = user;
  return rest;
}

export async function requireUser(req: Request) {
  const u = await current(req);
  if (!u) throw new HttpError(401, '로그인이 필요합니다.');
  return u;
}
export const isStaff = (role?: string | null) => role === 'admin' || role === 'manager';
export async function requireStaff(req: Request) {
  const u = await requireUser(req);
  if (!isStaff(u.role)) throw new HttpError(403, '관리자 권한이 필요합니다.');
  return u;
}
export async function requireAdmin(req: Request) {
  const u = await requireUser(req);
  if (u.role !== 'admin') throw new HttpError(403, '최고 관리자 권한이 필요합니다.');
  return u;
}

export async function createSession(req: Request, user: { id: string; name: string; email: string; role: string }) {
  await run('INSERT OR IGNORE INTO user_profiles (user_id,avatar) VALUES (?,?)', user.id, crypto.getRandomValues(new Uint32Array(1))[0] % 30);
  const token = uid() + uid();
  await batch([
    stmt('INSERT INTO sessions (id,user_id,expires) VALUES (?,?,?)', token, user.id, Date.now() + SESSION_MS),
    stmt('DELETE FROM sessions WHERE expires<?', Date.now()),
    stmt('INSERT INTO activity_log (id,user_id,kind,detail,created) VALUES (?,?,?,?,?)', uid(), user.id, 'login', '', now()),
  ]);
  return { token, header: setCookie(SESSION_COOKIE, token, SESSION_MS / 1000, req) };
}

export async function destroySession(req: Request) {
  const token = sessionToken(req);
  if (token) await run('DELETE FROM sessions WHERE id=?', token);
  return setCookie(SESSION_COOKIE, '', 0, req);
}

/** 로그인 시도 제한: 15분 내 이메일 기준 10회, IP 기준 60회(공용 IP 고려) */
const WINDOW = 15 * 60 * 1000;
const LIMIT = 10;
export async function checkRateLimit(req: Request, email: string) {
  const keys = ['ip:' + clientIp(req), 'email:' + email];
  const rows = await all<{ key: string; count: number; first: number }>(`SELECT * FROM login_attempts WHERE key IN (?,?)`, ...keys);
  for (const r of rows) {
    const limit = r.key.startsWith('ip:') ? LIMIT * 6 : LIMIT;
    if (Date.now() - r.first < WINDOW && r.count >= limit) {
      throw new HttpError(429, '로그인 시도가 너무 많습니다. 15분 후 다시 시도해 주세요.');
    }
  }
}
export async function recordFailure(req: Request, email: string) {
  const keys = ['ip:' + clientIp(req), 'email:' + email];
  const t = Date.now();
  await batch(
    keys.map((k) =>
      stmt(
        `INSERT INTO login_attempts (key,count,first) VALUES (?,1,?)
         ON CONFLICT(key) DO UPDATE SET count=CASE WHEN ?-login_attempts.first>? THEN 1 ELSE login_attempts.count+1 END,
                                        first=CASE WHEN ?-login_attempts.first>? THEN ? ELSE login_attempts.first END`,
        k, t, t, WINDOW, t, WINDOW, t,
      ),
    ),
  );
}
/** IP 단위 간단 제한(가입·재설정 요청 등): 15분 내 limit 회 */
export async function ipLimit(req: Request, bucket: string, limit = 10) {
  const key = `${bucket}:${clientIp(req)}`;
  const t = Date.now();
  const r = await first<{ count: number; first: number }>('SELECT count, first FROM login_attempts WHERE key=?', key);
  if (r && t - r.first < WINDOW && r.count >= limit) throw new HttpError(429, '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.');
  await run(
    `INSERT INTO login_attempts (key,count,first) VALUES (?,1,?)
     ON CONFLICT(key) DO UPDATE SET count=CASE WHEN ?-login_attempts.first>? THEN 1 ELSE login_attempts.count+1 END,
                                    first=CASE WHEN ?-login_attempts.first>? THEN ? ELSE login_attempts.first END`,
    key, t, t, WINDOW, t, WINDOW, t,
  );
}
export async function clearFailures(req: Request, email: string) {
  await run(`DELETE FROM login_attempts WHERE key IN (?,?)`, 'ip:' + clientIp(req), 'email:' + email);
}

export const randomAvatar = () => crypto.getRandomValues(new Uint32Array(1))[0] % 30;
