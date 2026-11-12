import { batch, stmt, now, uid, all, chunks, background, bumpVersion } from './db';
import { getSettings, mailReady } from './settings';
import { sendMailBatch } from './mail';

export type NotificationType = 'reply' | 'announcement' | 'assignment' | 'approval' | 'certificate' | 'system' | 'question' | 'event';

/** 메일로도 보낼 수 있는 알림 종류와 기본값(교육생 / 운영진) */
export const EMAIL_TYPES: { type: NotificationType; label: string; student: boolean; staff: boolean }[] = [
  { type: 'approval', label: '계정 승인·가입 신청', student: true, staff: true },
  { type: 'reply', label: '질문 답변', student: true, staff: false },
  { type: 'assignment', label: '과제 피드백·마감 안내', student: true, staff: false },
  { type: 'certificate', label: '수료', student: true, staff: false },
  { type: 'announcement', label: '공지사항', student: true, staff: false },
  { type: 'event', label: '라이브 세션 일정·시작 알림', student: true, staff: false },
  { type: 'question', label: '새 질문 (운영진)', student: false, staff: false },
];

/** 사용자 설정(user_profiles.notify_prefs JSON {email:{type:boolean}})과 기본값으로 메일 수신 여부 판단 */
export function wantsEmail(prefs: string, role: string, type: string) {
  const def = EMAIL_TYPES.find((t) => t.type === type);
  if (!def) return false;
  let p: any = {};
  try { p = prefs ? JSON.parse(prefs) : {}; } catch { p = {}; }
  const v = p?.email?.[type];
  if (typeof v === 'boolean') return v;
  return role === 'student' ? def.student : def.staff;
}

export async function notify(userIds: string[], type: NotificationType, title: string, body = '', link = '') {
  const ids = Array.from(new Set(userIds.filter(Boolean)));
  if (!ids.length) return;
  const t = now();
  // D1 batch 는 100개 단위로
  for (let i = 0; i < ids.length; i += 90) {
    await batch(ids.slice(i, i + 90).map((u) => stmt('INSERT INTO notifications (id,user_id,type,title,body,link,read,created) VALUES (?,?,?,?,?,?,0,?)', uid(), u, type, title, body.slice(0, 500), link, t)));
  }
  await bumpVersion();
  if (EMAIL_TYPES.some((e) => e.type === type)) await background(() => emailNotify(ids, type, title, body, link));
}

/** 메일 알림 — 메일 설정이 있고 사용자가 수신을 원할 때만. 체험·소셜 임시 주소는 제외 */
async function emailNotify(ids: string[], type: NotificationType, title: string, body: string, link: string) {
  const settings = await getSettings();
  if (!mailReady(settings) || settings.mail_notify === '0') return;
  const origin = settings.site_origin || '';
  const site = settings.site_name || '셀러브릭스 캠퍼스';
  const rows = (await Promise.all(chunks(ids).map((part) => all<{ id: string; email: string; role: string; prefs: string }>(
    `SELECT users.id, users.email, users.role, COALESCE(user_profiles.notify_prefs,'') AS prefs FROM users LEFT JOIN user_profiles ON user_profiles.user_id=users.id
     WHERE users.status='active' AND users.id NOT LIKE 'demo-%' AND users.email NOT LIKE '%@oauth.sellerbricks.local' AND users.id IN (${part.map(() => '?').join(',')})`, ...part)))).flat();
  const to = rows.filter((r) => wantsEmail(r.prefs, r.role, type));
  if (!to.length) return;
  const text = `${title}\n\n${body ? body + '\n\n' : ''}${origin && link ? `바로가기: ${origin}${link}\n\n` : ''}─\n${site}에서 보낸 알림입니다.${origin ? ` 메일 수신 설정: ${origin}/learn/notifications` : ''}`;
  await sendMailBatch(settings, to.map((r) => ({ to: r.email, subject: `[${site}] ${title}`, text })));
}

export async function notifyAdmins(type: NotificationType, title: string, body = '', link = '') {
  const admins = await all<{ id: string }>(`SELECT id FROM users WHERE role IN ('admin','manager') AND status='active'`);
  await notify(admins.map((a) => a.id), type, title, body, link);
}

export async function logActivity(userId: string, kind: string, detail = '') {
  await batch([stmt('INSERT INTO activity_log (id,user_id,kind,detail,created) VALUES (?,?,?,?,?)', uid(), userId, kind, detail.slice(0, 500), now())]);
}
