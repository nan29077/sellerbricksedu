import { first, run, batch, stmt, now, uid, HttpError } from '../db';
import { out, str, num, siteUrl, setCookie } from '../http';
import { createSession, destroySession, encodePassword, verifyPassword, checkRateLimit, recordFailure, clearFailures, ipLimit, randomAvatar, sessionToken, isStaff, isDemo, SESSION_COOKIE, type SessionUser } from '../auth';
import { notify, notifyAdmins, logActivity, EMAIL_TYPES } from '../notify';
import { sendMail } from '../mail';
import { mailReady } from '../settings';
import { newSecret, verifyTotp, otpauthUri } from '../totp';
import type { Ctx } from './types';
import { purgeUser } from './admin';

const EMAIL = /^\S+@\S+\.\S+$/;
const MFA_MS = 5 * 60 * 1000;

export async function demo({ req, body, settings }: Ctx) {
  if (settings.demo_mode !== '1') throw new HttpError(403, '체험 계정이 비활성화되어 있습니다.');
  if (!['admin', 'student'].includes(body.role)) throw new HttpError(400, '잘못된 계정입니다.');
  await ipLimit(req, 'demo', 100);
  const id = 'demo-' + body.role;
  await run('INSERT OR IGNORE INTO users (id,email,name,role,status,created) VALUES (?,?,?,?,?,?)', id, id + '@sellerbricks.test', body.role === 'admin' ? '캠퍼스 관리자' : '김셀러', body.role, 'active', now());
  if (body.role === 'student') await run("INSERT OR IGNORE INTO memberships (user_id,cohort_id) VALUES (?,'cohort-1')", id);
  const u = await first<any>('SELECT * FROM users WHERE id=?', id);
  if (u.status !== 'active') throw new HttpError(403, '체험 계정이 중지되어 있습니다.');
  const s = await createSession(req, u);
  return out({ user: { id: u.id, name: u.name, email: u.email, role: u.role } }, 200, { 'Set-Cookie': s.header });
}

/** 이메일 인증 링크 발송 (메일 설정이 있을 때만) */
async function sendVerification(req: Request, settings: Record<string, string>, user: { id: string; name: string; email: string }) {
  if (!mailReady(settings)) return false;
  const token = uid() + uid();
  await batch([
    stmt('DELETE FROM email_verifications WHERE user_id=? OR expires<?', user.id, Date.now()),
    stmt('INSERT INTO email_verifications (token,user_id,email,expires,created) VALUES (?,?,?,?,?)', token, user.id, user.email, Date.now() + 48 * 3600000, now()),
  ]);
  const site = settings.site_name || '셀러브릭스 캠퍼스';
  return sendMail(settings, user.email, `[${site}] 이메일 주소를 확인해 주세요`, `${user.name}님, 아래 링크를 눌러 이메일 주소를 확인해 주세요. (48시간 유효)\n\n${siteUrl(req)}/verify-email/${token}\n\n가입하지 않았다면 이 메일을 무시해 주세요.`);
}

export async function register({ req, body, settings }: Ctx) {
  const email = str(body.email, 200).toLowerCase();
  await ipLimit(req, 'register', 10);
  const name = str(body.name, 30);
  const password = String(body.password || '');
  if (!EMAIL.test(email) || password.length < 10 || password.length > 128 || name.length < 2) throw new HttpError(400, '이름(2자 이상), 이메일과 10자 이상의 비밀번호를 입력해 주세요.');
  if (body.agree !== true) throw new HttpError(400, '이용약관과 개인정보 수집·이용에 동의해 주세요.');
  const id = uid();
  const auto = settings.auto_approve === '1';
  try {
    await batch([
      stmt('INSERT INTO users (id,email,name,role,password,status,created,email_verified) VALUES (?,?,?,?,?,?,?,0)', id, email, name, 'student', await encodePassword(password), auto ? 'active' : 'pending', now()),
      stmt('INSERT INTO user_profiles (user_id,avatar) VALUES (?,?)', id, randomAvatar()),
    ]);
  } catch {
    throw new HttpError(400, '이미 등록된 이메일입니다.');
  }
  await logActivity(id, 'consent', '이용약관·개인정보 수집·이용·만 14세 이상 동의');
  const mailed = await sendVerification(req, settings, { id, name, email });
  await notifyAdmins('approval', auto ? '새 교육생이 가입했습니다' : '승인 대기 교육생이 있습니다', `${name} (${email})`, '/admin/members');
  const verifyNote = mailed ? ' 가입한 이메일로 보낸 인증 링크를 눌러 주소를 확인해 주세요.' : '';
  return out({ ok: true, message: (auto ? '가입이 완료되었습니다. 바로 로그인해 주세요.' : '가입 신청이 완료되었습니다. 관리자가 셀러 자격을 확인한 후 승인하면 로그인할 수 있습니다.') + verifyNote });
}

/** 2단계 인증 대기 토큰 */
export async function createMfaChallenge(userId: string, returnTo = '') {
  const token = uid() + uid();
  await batch([
    stmt('DELETE FROM mfa_challenges WHERE user_id=? OR expires<?', userId, Date.now()),
    stmt('INSERT INTO mfa_challenges (token,user_id,expires,attempts,return_to) VALUES (?,?,?,0,?)', token, userId, Date.now() + MFA_MS, returnTo.slice(0, 300)),
  ]);
  return token;
}
async function hasMfa(userId: string) {
  return !!(await first('SELECT 1 FROM user_profiles WHERE user_id=? AND totp_enabled=1', userId));
}

export async function login({ req, body }: Ctx) {
  const email = str(body.email, 200).toLowerCase();
  await checkRateLimit(req, email);
  const u = await first<any>('SELECT * FROM users WHERE email=?', email);
  if (!(await verifyPassword(u?.password, String(body.password || '')))) {
    await recordFailure(req, email);
    throw new HttpError(401, '이메일 또는 비밀번호를 확인해 주세요.');
  }
  if (u.status === 'pending') throw new HttpError(403, '관리자 승인 대기 중인 계정입니다. 승인 후 알림을 받게 됩니다.');
  if (u.status !== 'active') throw new HttpError(403, '이용이 중지된 계정입니다. 관리자에게 문의해 주세요.');
  await clearFailures(req, email);
  if (await hasMfa(u.id)) return out({ mfa: await createMfaChallenge(u.id) });
  const s = await createSession(req, u);
  return out({ user: { id: u.id, name: u.name, email: u.email, role: u.role } }, 200, { 'Set-Cookie': s.header });
}

/** 2단계 인증 코드 확인 → 로그인 완료 (토큰당 5회) */
export async function loginMfa({ req, body }: Ctx) {
  const token = str(body.token, 100);
  const c = await first<any>('SELECT * FROM mfa_challenges WHERE token=? AND expires>?', token, Date.now());
  if (!c) throw new HttpError(400, '인증 시간이 지났습니다. 처음부터 다시 로그인해 주세요.');
  if (c.attempts >= 5) { await run('DELETE FROM mfa_challenges WHERE token=?', token); throw new HttpError(429, '인증 코드를 여러 번 틀렸습니다. 처음부터 다시 로그인해 주세요.'); }
  const p = await first<any>('SELECT totp_secret FROM user_profiles WHERE user_id=? AND totp_enabled=1', c.user_id);
  if (!p || !(await verifyTotp(p.totp_secret, str(body.code, 10)))) {
    await run('UPDATE mfa_challenges SET attempts=attempts+1 WHERE token=?', token);
    throw new HttpError(401, '인증 코드가 올바르지 않습니다. 앱에 표시된 6자리 숫자를 입력해 주세요.');
  }
  await run('DELETE FROM mfa_challenges WHERE token=?', token);
  const u = await first<any>('SELECT * FROM users WHERE id=?', c.user_id);
  if (!u || u.status !== 'active') throw new HttpError(403, '이용할 수 없는 계정입니다.');
  const s = await createSession(req, u);
  return out({ user: { id: u.id, name: u.name, email: u.email, role: u.role }, returnTo: c.return_to || '' }, 200, { 'Set-Cookie': s.header });
}

export async function logout({ req }: Ctx) {
  const header = await destroySession(req);
  return out({ ok: true }, 200, { 'Set-Cookie': header });
}

/** 비밀번호 재설정 요청 — 메일 발송 설정이 있으면 메일, 없으면 관리자 화면에서 링크 전달 */
export async function forgot({ req, body, settings }: Ctx) {
  const email = str(body.email, 200).toLowerCase();
  await ipLimit(req, 'forgot', 5);
  const generic = { ok: true, message: '등록된 이메일이면 재설정 안내가 진행됩니다. 메일이 오지 않으면 관리자에게 문의해 주세요.' };
  const u = await first<any>("SELECT id,name,password FROM users WHERE email=? AND status!='suspended' AND id NOT LIKE 'demo-%'", email);
  if (!u) return out(generic);
  const token = uid() + uid();
  const mail = mailReady(settings);
  await batch([
    stmt('DELETE FROM password_resets WHERE user_id=? OR expires<?', u.id, Date.now()),
    stmt('INSERT INTO password_resets (token,user_id,expires,created,kind) VALUES (?,?,?,?,?)', token, u.id, Date.now() + 3600000, now(), mail ? 'mail' : 'request'),
  ]);
  const link = `${siteUrl(req)}/reset/${token}`;
  const mailed = mail && (await sendMail(settings, email, `[${settings.site_name || '셀러브릭스 캠퍼스'}] 비밀번호 재설정`, `${u.name}님, 아래 링크에서 1시간 내에 비밀번호를 다시 설정해 주세요.\n\n${link}\n\n요청하지 않았다면 이 메일을 무시해 주세요.`));
  if (!mailed) {
    await run("UPDATE password_resets SET kind='request' WHERE token=?", token);
    await notifyAdmins('system', '비밀번호 재설정 요청', `${u.name}님이 재설정을 요청했습니다. 교육생 관리에서 링크를 전달해 주세요.`, '/admin/members');
  }
  return out(generic);
}

export async function resetPassword({ req, body }: Ctx) {
  const token = str(body.token, 100);
  const next = String(body.password || '');
  if (next.length < 10 || next.length > 128) throw new HttpError(400, '새 비밀번호는 10~128자여야 합니다.');
  const r = await first<any>('SELECT user_id, kind FROM password_resets WHERE token=? AND expires>?', token, Date.now());
  if (!r) throw new HttpError(400, '재설정 링크가 만료되었거나 올바르지 않습니다.');
  await batch([
    // 메일로 받은 링크로 설정했다면 이메일 소유가 확인된 것
    stmt(`UPDATE users SET password=?, email_verified=CASE WHEN ? IN ('mail','invite_mail') THEN 1 ELSE email_verified END WHERE id=?`, await encodePassword(next), r.kind, r.user_id),
    stmt('DELETE FROM password_resets WHERE user_id=?', r.user_id),
    stmt('DELETE FROM sessions WHERE user_id=?', r.user_id),
  ]);
  await logActivity(r.user_id, 'password_reset');
  const u = await first<any>('SELECT * FROM users WHERE id=?', r.user_id);
  if (u.status !== 'active') return out({ ok: true, message: '비밀번호를 변경했습니다. 계정 승인 후 로그인할 수 있습니다.' });
  if (await hasMfa(u.id)) return out({ ok: true, mfa: await createMfaChallenge(u.id, '/learn'), message: '비밀번호를 변경했습니다. 2단계 인증 코드를 입력해 주세요.' });
  const s = await createSession(req, u);
  return out({ ok: true, message: '비밀번호를 변경하고 로그인했습니다.' }, 200, { 'Set-Cookie': s.header });
}

/** 이메일 인증 링크 확인 (로그인 불필요) */
export async function verifyEmail({ body }: Ctx) {
  const token = str(body.token, 100);
  const r = await first<any>('SELECT user_id, email FROM email_verifications WHERE token=? AND expires>?', token, Date.now());
  if (!r) throw new HttpError(400, '인증 링크가 만료되었거나 이미 사용되었습니다. 계정 설정에서 다시 받을 수 있어요.');
  await batch([
    stmt('UPDATE users SET email_verified=1 WHERE id=? AND email=?', r.user_id, r.email),
    stmt('DELETE FROM email_verifications WHERE user_id=?', r.user_id),
  ]);
  await logActivity(r.user_id, 'email_verified');
  return out({ ok: true, message: '이메일 주소가 확인되었습니다.' });
}
export async function verifySend({ req, user, settings }: Ctx & { user: SessionUser }) {
  if (isDemo(user)) throw new HttpError(400, '체험 계정은 이메일 인증을 할 수 없습니다.');
  if (user.email_verified) return out({ ok: true, message: '이미 확인된 이메일입니다.' });
  await ipLimit(req, 'verify', 5);
  if (!(await sendVerification(req, settings, user))) throw new HttpError(400, '메일 발송이 설정되지 않았습니다. 관리자에게 문의해 주세요.');
  return out({ ok: true, message: '인증 메일을 보냈습니다. 메일함을 확인해 주세요.' });
}

export async function profile({ body, user }: Ctx & { user: SessionUser }) {
  const name = str(body.name, 30);
  const avatar = num(body.avatar, -1);
  const bio = str(body.bio, 200);
  if (name.length < 2 || !Number.isInteger(avatar) || avatar < 0 || avatar > 29) throw new HttpError(400, '2~30자의 대화명과 캐릭터를 선택해 주세요.');
  await batch([
    stmt(
      'INSERT INTO user_profiles (user_id,avatar,name_changes,bio) VALUES (?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET avatar=excluded.avatar,name_changes=user_profiles.name_changes+excluded.name_changes,bio=excluded.bio',
      user.id, avatar, name !== user.name ? 1 : 0, bio,
    ),
    stmt('UPDATE users SET name=? WHERE id=?', name, user.id),
  ]);
  return out({ ok: true });
}

export async function preferences({ body, user }: Ctx & { user: SessionUser }) {
  if (body.weeklyGoal !== undefined) {
    const goal = Math.min(30, Math.max(1, num(body.weeklyGoal, 3)));
    await run('INSERT INTO user_profiles (user_id,avatar,weekly_goal) VALUES (?,?,?) ON CONFLICT(user_id) DO UPDATE SET weekly_goal=excluded.weekly_goal', user.id, randomAvatar(), goal);
  }
  if (body.email && typeof body.email === 'object') {
    const email: Record<string, boolean> = {};
    for (const t of EMAIL_TYPES) if (typeof body.email[t.type] === 'boolean') email[t.type] = body.email[t.type];
    await run('INSERT INTO user_profiles (user_id,avatar,notify_prefs) VALUES (?,?,?) ON CONFLICT(user_id) DO UPDATE SET notify_prefs=excluded.notify_prefs', user.id, randomAvatar(), JSON.stringify({ email }));
  }
  return out({ ok: true });
}

/** 비밀번호 변경. 비밀번호가 없는 계정(소셜·초대)은 현재 비밀번호 없이 새로 설정 */
export async function password({ req, body, user }: Ctx & { user: SessionUser }) {
  if (isDemo(user)) throw new HttpError(400, '이 계정에서는 비밀번호를 변경할 수 없습니다.');
  const account = await first<any>('SELECT password FROM users WHERE id=?', user.id);
  const next = String(body.newPassword || '');
  if (next.length < 10 || next.length > 128 || next !== body.confirmPassword) throw new HttpError(400, '새 비밀번호는 10~128자이며 확인 입력과 일치해야 합니다.');
  if (account?.password) {
    if (!(await verifyPassword(account.password, String(body.currentPassword || '')))) throw new HttpError(400, '현재 비밀번호를 확인해 주세요.');
    if (next === body.currentPassword) throw new HttpError(400, '현재 비밀번호와 다른 비밀번호를 입력해 주세요.');
  }
  await batch([
    stmt('UPDATE users SET password=? WHERE id=?', await encodePassword(next), user.id),
    stmt('DELETE FROM sessions WHERE user_id=? AND id!=?', user.id, sessionToken(req)),
  ]);
  await logActivity(user.id, account?.password ? 'password_change' : 'password_set');
  return out({ ok: true });
}

export async function signoutOthers({ req, user }: Ctx & { user: SessionUser }) {
  await run('DELETE FROM sessions WHERE user_id=? AND id!=?', user.id, sessionToken(req));
  return out({ ok: true });
}

/** 회원 탈퇴: 본인 확인 후 계정과 학습 기록·게시물을 즉시 삭제 */
export async function withdraw({ req, body, user }: Ctx & { user: SessionUser }) {
  if (isDemo(user)) throw new HttpError(400, '체험 계정은 탈퇴할 수 없습니다.');
  const account = await first<any>('SELECT password,email,role FROM users WHERE id=?', user.id);
  if (!account) throw new HttpError(404, '계정을 찾을 수 없습니다.');
  if (account.password) {
    if (!(await verifyPassword(account.password, String(body.password || '')))) throw new HttpError(400, '비밀번호를 확인해 주세요.');
  } else if (str(body.confirm, 10) !== '탈퇴') {
    throw new HttpError(400, "확인을 위해 '탈퇴'를 입력해 주세요.");
  }
  if (account.role === 'admin') {
    const others = await first<{ n: number }>("SELECT COUNT(*) AS n FROM users WHERE role='admin' AND status='active' AND id!=? AND id NOT LIKE 'demo-%'", user.id);
    if (!others?.n) throw new HttpError(400, '마지막 최고 관리자는 탈퇴할 수 없습니다. 다른 최고 관리자를 먼저 지정해 주세요.');
  }
  await purgeUser(user.id);
  await run('DELETE FROM login_attempts WHERE key=?', 'email:' + account.email);
  await notifyAdmins('system', '회원 탈퇴', '교육생 1명이 탈퇴하여 계정과 학습 기록이 삭제되었습니다.', '/admin/members');
  return out({ ok: true }, 200, { 'Set-Cookie': setCookie(SESSION_COOKIE, '', 0, req) });
}

export async function notifRead({ body, user }: Ctx & { user: SessionUser }) {
  if (body.all) await run('UPDATE notifications SET read=1 WHERE user_id=?', user.id);
  else await run('UPDATE notifications SET read=1 WHERE user_id=? AND id=?', user.id, str(body.id, 100));
  return out({ ok: true });
}

/** 읽은 알림 비우기 */
export async function notifClear({ user }: Ctx & { user: SessionUser }) {
  await run('DELETE FROM notifications WHERE user_id=? AND read=1', user.id);
  return out({ ok: true });
}

// ───────── 2단계 인증 (운영진) ─────────
export async function mfaSetup({ user }: Ctx & { user: SessionUser }) {
  if (!isStaff(user.role) || isDemo(user)) throw new HttpError(403, '2단계 인증은 운영진 계정에서 사용할 수 있습니다.');
  if (user.mfa) throw new HttpError(400, '이미 2단계 인증을 사용 중입니다.');
  const secret = newSecret();
  await run('INSERT INTO user_profiles (user_id,avatar,totp_secret,totp_enabled) VALUES (?,?,?,0) ON CONFLICT(user_id) DO UPDATE SET totp_secret=excluded.totp_secret, totp_enabled=0', user.id, randomAvatar(), secret);
  return out({ ok: true, secret, uri: otpauthUri(secret, user.email) });
}
export async function mfaEnable({ req, body, user }: Ctx & { user: SessionUser }) {
  if (!isStaff(user.role) || isDemo(user)) throw new HttpError(403, '2단계 인증은 운영진 계정에서 사용할 수 있습니다.');
  const p = await first<any>('SELECT totp_secret FROM user_profiles WHERE user_id=?', user.id);
  if (!p?.totp_secret) throw new HttpError(400, '먼저 인증 앱 등록을 시작해 주세요.');
  if (!(await verifyTotp(p.totp_secret, str(body.code, 10)))) throw new HttpError(400, '인증 코드가 올바르지 않습니다. 앱에 표시된 6자리 숫자를 입력해 주세요.');
  await batch([
    stmt('UPDATE user_profiles SET totp_enabled=1 WHERE user_id=?', user.id),
    stmt('DELETE FROM sessions WHERE user_id=? AND id!=?', user.id, sessionToken(req)),
  ]);
  await logActivity(user.id, 'mfa_enable');
  return out({ ok: true });
}
export async function mfaDisable({ body, user }: Ctx & { user: SessionUser }) {
  const p = await first<any>('SELECT totp_secret, totp_enabled FROM user_profiles WHERE user_id=?', user.id);
  if (!p?.totp_enabled) throw new HttpError(400, '2단계 인증을 사용하고 있지 않습니다.');
  if (!(await verifyTotp(p.totp_secret, str(body.code, 10)))) throw new HttpError(400, '인증 코드가 올바르지 않습니다.');
  await run("UPDATE user_profiles SET totp_enabled=0, totp_secret='' WHERE user_id=?", user.id);
  await logActivity(user.id, 'mfa_disable');
  return out({ ok: true });
}

export { notify };
