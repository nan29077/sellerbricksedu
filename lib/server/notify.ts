import { batch, stmt, now, uid, all } from './db';

export type NotificationType = 'reply' | 'announcement' | 'assignment' | 'approval' | 'certificate' | 'system' | 'question';

export async function notify(userIds: string[], type: NotificationType, title: string, body = '', link = '') {
  const ids = Array.from(new Set(userIds.filter(Boolean)));
  if (!ids.length) return;
  const t = now();
  // D1 batch 는 100개 단위로
  for (let i = 0; i < ids.length; i += 90) {
    await batch(ids.slice(i, i + 90).map((u) => stmt('INSERT INTO notifications (id,user_id,type,title,body,link,read,created) VALUES (?,?,?,?,?,?,0,?)', uid(), u, type, title, body.slice(0, 500), link, t)));
  }
}

export async function notifyAdmins(type: NotificationType, title: string, body = '', link = '') {
  const admins = await all<{ id: string }>(`SELECT id FROM users WHERE role IN ('admin','manager') AND status='active'`);
  await notify(admins.map((a) => a.id), type, title, body, link);
}

export async function logActivity(userId: string, kind: string, detail = '') {
  await batch([stmt('INSERT INTO activity_log (id,user_id,kind,detail,created) VALUES (?,?,?,?,?)', uid(), userId, kind, detail.slice(0, 500), now())]);
}
