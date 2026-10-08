import { first, run, batch, stmt, now, uid, HttpError } from '../db';
import { out, str, num, siteUrl } from '../http';
import { createSession, destroySession, encodePassword, verifyPassword, checkRateLimit, recordFailure, clearFailures, randomAvatar, sessionToken, type SessionUser } from '../auth';
import { notify, notifyAdmins, logActivity } from '../notify';
import { sendMail } from '../mail';
import type { Ctx } from './types';

const EMAIL = /^\S+@\S+\.\S+$/;

export async function demo({ req, body }: Ctx) {
  if (!['admin', 'student'].includes(body.role)) throw new HttpError(400, '잘못된 계정입니다.');
  const id = 'demo-' + body.role;
  await run('INSERT OR IGNORE INTO users (id,email,name,role,status,created) VALUES (?,?,?,?,?,?)', id, id + '@sellerbricks.test', body.role === 'admin' ? '에듀 관리자' : '김셀러', body.role, 'active', now());
  if (body.role === 'student') await run("INSERT OR IGNORE INTO memberships (user_id,cohort_id) VALUES (?,'cohort-1')", id);
  const u = await first<any>('SELECT * FROM users WHERE id=?', id);
  const s = await createSession(req, u);
  return out({ user: { id: u.id, name: u.name, email: u.email, role: u.role } }, 200, { 'Set-Cookie': s.header });
}

export async function register({ body, settings }: Ctx) {
  const email = str(body.email, 200).toLowerCase();
  const name = str(body.name, 30);
  const password = String(body.password || '');
  if (!EMAIL.test(email) || password.length < 10 || password.length > 128 || name.length < 2) throw new HttpError(400, '이름(2자 이상), 이메일과 10자 이상의 비밀번호를 입력해 주세요.');
  const id = uid();
  const auto = settings.auto_approve === '1';
  try {
    await batch([
      stmt('INSERT INTO users (id,email,name,role,password,status,created) VALUES (?,?,?,?,?,?,?)', id, email, name, 'student', await encodePassword(password), auto ? 'active' : 'pending', now()),
      stmt('INSERT INTO user_profiles (user_id,avatar) VALUES (?,?)', id, randomAvatar()),
    ]);
  } catch {
    throw new HttpError(400, '이미 등록된 이메일입니다.');
  }
  await notifyAdmins('approval', auto ? '새 교육생이 가입했습니다' : '승인 대기 교육생이 있습니다', `${name} (${email})`, '/admin/members');
  return out({ ok: true, message: auto ? '가입이 완료되었습니다. 바로 로그인해 주세요.' : '가입 신청이 완료되었습니다. 관리자가 셀러 자격을 확인한 후 승인하면 로그인할 수 있습니다.' });
}

export async function login({ req, body }: Ctx) {
  const email = str(body.email, 200).toLowerCase();
  await checkRateLimit(req, email);
  const u = await first<any>('SELECT * FROM users WHERE email=?', email);
  if (!u?.password || !(await verifyPassword(u.password, String(body.password || '')))) {
    await recordFailure(req, email);
    throw new HttpError(401, '이메일 또는 비밀번호를 확인해 주세요.');
  }
  if (u.status === 'pending') throw new HttpError(403, '관리자 승인 대기 중인 계정입니다. 승인 후 알림을 받게 됩니다.');
  if (u.status !== 'active') throw new HttpError(403, '이용이 중지된 계정입니다. 관리자에게 문의해 주세요.');
  await clearFailures(req, email);
  const s = await createSession(req, u);
  return out({ user: { id: u.id, name: u.name, email: u.email, role: u.role } }, 200, { 'Set-Cookie': s.header });
}

export async function logout({ req }: Ctx) {
  const header = await destroySession(req);
  return out({ ok: true }, 200, { 'Set-Cookie': header });
}

/** 비밀번호 재설정 요청 — 메일 발송 설정이 있으면 메일, 없으면 관리자 화면에서 링크 전달 */
export async function forgot({ req, body, settings }: Ctx) {
  const email = str(body.email, 200).toLowerCase();
  const generic = { ok: true, message: '등록된 이메일이면 재설정 안내가 진행됩니다. 메일이 오지 않으면 관리자에게 문의해 주세요.' };
  const u = await first<any>('SELECT id,name,password FROM users WHERE email=? AND status!=?', email, 'suspended');
  if (!u || !u.password) return out(generic);
  const token = uid() + uid();
  await batch([
    stmt('DELETE FROM password_resets WHERE user_id=? OR expires<?', u.id, Date.now()),
    stmt('INSERT INTO password_resets (token,user_id,expires,created) VALUES (?,?,?,?)', token, u.id, Date.now() + 3600000, now()),
  ]);
  const link = `${siteUrl(req)}/reset/${token}`;
  const mailed = await sendMail(settings, email, '[셀러브릭스 에듀] 비밀번호 재설정', `${u.name}님, 아래 링크에서 1시간 내에 비밀번호를 다시 설정해 주세요.\n\n${link}\n\n요청하지 않았다면 이 메일을 무시해 주세요.`);
  if (!mailed) await notifyAdmins('system', '비밀번호 재설정 요청', `${u.name}님이 재설정을 요청했습니다. 교육생 관리에서 링크를 전달해 주세요.`, '/admin/members');
  return out(generic);
}

export async function resetPassword({ req, body }: Ctx) {
  const token = str(body.token, 100);
  const next = String(body.password || '');
  if (next.length < 10 || next.length > 128) throw new HttpError(400, '새 비밀번호는 10~128자여야 합니다.');
  const r = await first<any>('SELECT user_id FROM password_resets WHERE token=? AND expires>?', token, Date.now());
  if (!r) throw new HttpError(400, '재설정 링크가 만료되었거나 올바르지 않습니다.');
  await batch([
    stmt('UPDATE users SET password=? WHERE id=?', await encodePassword(next), r.user_id),
    stmt('DELETE FROM password_resets WHERE user_id=?', r.user_id),
    stmt('DELETE FROM sessions WHERE user_id=?', r.user_id),
  ]);
  await logActivity(r.user_id, 'password_reset');
  const u = await first<any>('SELECT * FROM users WHERE id=?', r.user_id);
  if (u.status !== 'active') return out({ ok: true, message: '비밀번호를 변경했습니다. 계정 승인 후 로그인할 수 있습니다.' });
  const s = await createSession(req, u);
  return out({ ok: true, message: '비밀번호를 변경하고 로그인했습니다.' }, 200, { 'Set-Cookie': s.header });
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
  const goal = Math.min(30, Math.max(1, num(body.weeklyGoal, 3)));
  await run('INSERT INTO user_profiles (user_id,avatar,weekly_goal) VALUES (?,?,?) ON CONFLICT(user_id) DO UPDATE SET weekly_goal=excluded.weekly_goal', user.id, randomAvatar(), goal);
  return out({ ok: true });
}

export async function password({ req, body, user }: Ctx & { user: SessionUser }) {
  const account = await first<any>('SELECT password FROM users WHERE id=?', user.id);
  if (user.id.startsWith('demo-') || !account?.password) throw new HttpError(400, '이 계정에서는 비밀번호를 변경할 수 없습니다.');
  const next = String(body.newPassword || '');
  if (next.length < 10 || next.length > 128 || next !== body.confirmPassword) throw new HttpError(400, '새 비밀번호는 10~128자이며 확인 입력과 일치해야 합니다.');
  if (!(await verifyPassword(account.password, String(body.currentPassword || '')))) throw new HttpError(400, '현재 비밀번호를 확인해 주세요.');
  if (next === body.currentPassword) throw new HttpError(400, '현재 비밀번호와 다른 비밀번호를 입력해 주세요.');
  await batch([
    stmt('UPDATE users SET password=? WHERE id=?', await encodePassword(next), user.id),
    stmt('DELETE FROM sessions WHERE user_id=? AND id!=?', user.id, sessionToken(req)),
  ]);
  return out({ ok: true });
}

export async function signoutOthers({ req, user }: Ctx & { user: SessionUser }) {
  await run('DELETE FROM sessions WHERE user_id=? AND id!=?', user.id, sessionToken(req));
  return out({ ok: true });
}

export async function notifRead({ body, user }: Ctx & { user: SessionUser }) {
  if (body.all) await run('UPDATE notifications SET read=1 WHERE user_id=?', user.id);
  else await run('UPDATE notifications SET read=1 WHERE user_id=? AND id=?', user.id, str(body.id, 100));
  return out({ ok: true });
}

export { notify };
