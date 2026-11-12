import { all, run, first, kstDay, now } from './db';
import { notify } from './notify';
import { reconcileCertificates } from './handlers/learning';

const EVERY_MS = 10 * 60 * 1000;
const kstLocal = (ms: number) => new Date(ms + 9 * 3600000).toISOString().slice(0, 16); // 'YYYY-MM-DDTHH:mm' (일정 입력 형식과 같음)
const iso = (ms: number) => new Date(ms).toISOString();

/**
 * 주기 작업 — 별도 스케줄러 없이 요청이 들어올 때 10분에 한 번만 실행된다(동시 요청 중 1개만 선점).
 * 자동 알림(일정 시작 1시간 전, 과제 마감 전날, 장기 미학습)과 오래된 기록 정리.
 */
export async function maybeMaintain(settings: Record<string, string>) {
  const t = Date.now();
  const claimed = await run(
    `INSERT INTO settings (id,value) VALUES ('maint_at',?) ON CONFLICT(id) DO UPDATE SET value=excluded.value WHERE CAST(settings.value AS INTEGER) < ?`,
    String(t), t - EVERY_MS,
  ).catch(() => null);
  if (!claimed?.meta?.changes) return false;
  await maintain(settings, t);
  return true;
}

export async function maintain(settings: Record<string, string>, t = Date.now()) {
  const report: Record<string, number> = {};
  if (settings.auto_reminders !== '0') {
    // 1) 라이브 세션 시작 1시간 전 — 참석 신청자에게
    const soon = await all<any>('SELECT id, title, starts FROM events WHERE reminded=0 AND starts>=? AND starts<=?', kstLocal(t), kstLocal(t + 60 * 60000));
    for (const ev of soon) {
      const r = await run('UPDATE events SET reminded=1 WHERE id=? AND reminded=0', ev.id);
      if (!r.meta.changes) continue;
      const going = await all<{ user_id: string }>('SELECT user_id FROM event_rsvps WHERE event_id=?', ev.id);
      await notify(going.map((g) => g.user_id), 'event', `곧 시작: ${ev.title}`, `${String(ev.starts).replace('T', ' ')} 시작 · 일정 메뉴에서 입장하세요.`, '/learn/events');
      report.event = (report.event || 0) + going.length;
    }
    // 2) 과제 마감 전날 — 해당 과정을 시작했지만 아직 제출하지 않은 교육생에게
    const tomorrow = kstDay(new Date(t + 86400000));
    const due = await all<any>(
      `SELECT assignments.id, assignments.title, assignments.course_id, assignments.due FROM assignments JOIN courses ON courses.id=assignments.course_id
       WHERE assignments.published=1 AND courses.published=1 AND assignments.due=? AND assignments.due_reminded!=assignments.due`, tomorrow);
    for (const a of due) {
      const r = await run('UPDATE assignments SET due_reminded=due WHERE id=? AND due_reminded!=due', a.id);
      if (!r.meta.changes) continue;
      const targets = await all<{ id: string }>(
        `SELECT users.id FROM users WHERE users.status='active' AND users.role='student'
         AND EXISTS (SELECT 1 FROM progress JOIN lessons ON lessons.id=progress.lesson_id WHERE progress.user_id=users.id AND lessons.course_id=?)
         AND NOT EXISTS (SELECT 1 FROM submissions WHERE submissions.assignment_id=? AND submissions.user_id=users.id AND submissions.status!='revise')`, a.course_id, a.id);
      await notify(targets.map((x) => x.id), 'assignment', `내일 마감: ${a.title}`, `과제 마감일은 ${String(a.due).replace(/-/g, '.')}입니다. 잊지 말고 제출해 주세요.`, '/learn/assignments');
      report.assignment = (report.assignment || 0) + targets.length;
    }
    // 3) 7~30일 동안 학습 기록이 없는 교육생에게 2주에 한 번 독려 (수료 전인 경우만)
    const idle = await all<{ id: string }>(
      `SELECT users.id FROM users LEFT JOIN user_profiles ON user_profiles.user_id=users.id
       WHERE users.role='student' AND users.status='active' AND users.id NOT LIKE 'demo-%'
         AND COALESCE(user_profiles.nudged,'') < ?
         AND MAX(COALESCE((SELECT MAX(created) FROM activity_log WHERE user_id=users.id),''), COALESCE((SELECT MAX(updated) FROM progress WHERE user_id=users.id),''), users.created) BETWEEN ? AND ?
         AND (SELECT COUNT(*) FROM progress WHERE user_id=users.id AND complete=1) < (SELECT COUNT(*) FROM lessons JOIN courses ON courses.id=lessons.course_id WHERE courses.published=1)
       LIMIT 200`, iso(t - 14 * 86400000), iso(t - 30 * 86400000), iso(t - 7 * 86400000));
    if (idle.length) {
      for (const u of idle) await run('INSERT INTO user_profiles (user_id,avatar,nudged) VALUES (?,0,?) ON CONFLICT(user_id) DO UPDATE SET nudged=excluded.nudged', u.id, now());
      await notify(idle.map((u) => u.id), 'system', '학습을 이어가 볼까요?', '오늘 한 강의만 들어도 첫 라이브에 한 걸음 가까워져요.', '/learn');
      report.nudge = idle.length;
    }
  }
  // 4) 수료 조건을 채웠는데 수료증이 없는 경우 보정 (발급 실패 대비)
  for (const c of await all<{ id: string }>('SELECT id FROM courses WHERE published=1')) report.certificate = (report.certificate || 0) + (await reconcileCertificates(c.id));
  // 5) 오래된 기록 정리
  for (const [sql, ...params] of [
    ['DELETE FROM sessions WHERE expires<?', t],
    ['DELETE FROM password_resets WHERE expires<?', t],
    ['DELETE FROM email_verifications WHERE expires<?', t],
    ['DELETE FROM mfa_challenges WHERE expires<?', t],
    ['DELETE FROM login_attempts WHERE first<?', t - 86400000],
    ['DELETE FROM notifications WHERE read=1 AND created<?', iso(t - 90 * 86400000)],
    ['DELETE FROM notifications WHERE created<?', iso(t - 180 * 86400000)],
    ['DELETE FROM activity_log WHERE created<?', iso(t - 365 * 86400000)],
  ] as [string, ...unknown[]][]) {
    try { await run(sql, ...params); } catch (e) { console.warn('cleanup skipped', sql, e); }
  }
  void first;
  return report;
}
