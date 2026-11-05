import type { AdminUser, Course, LearningDay, Lesson, Progress } from './types';
import { addDays, kstDay } from './learning';

/** 마감일까지 남은 일수 (KST, 오늘=0, 지남=음수). 날짜가 없으면 null */
export function dday(due: string | undefined | null): number | null {
  if (!due) return null;
  const a = Date.parse(kstDay() + 'T00:00:00Z'), b = Date.parse(due.slice(0, 10) + 'T00:00:00Z');
  if (!Number.isFinite(b)) return null;
  return Math.round((b - a) / 86400000);
}
export const ddayLabel = (n: number | null) => (n == null ? '' : n === 0 ? 'D-DAY' : n > 0 ? `D-${n}` : `D+${-n}`);

/** 이번 주(월~일) 요일별 학습 분/완료 */
export function weekDays(days: LearningDay[]) {
  const today = kstDay();
  const dow = (new Date(today + 'T00:00:00Z').getUTCDay() + 6) % 7;
  const monday = addDays(today, -dow);
  const names = ['월', '화', '수', '목', '금', '토', '일'];
  return names.map((name, i) => {
    const day = addDays(monday, i);
    const d = days.find((x) => x.day === day);
    return { name, day, minutes: Math.round((d?.seconds || 0) / 60), completed: d?.completed || 0, today: day === today, future: day > today };
  });
}

/** 최근 N주 주간 학습 시간(분)·완료 수 */
export function weeklySeries(days: LearningDay[], weeks = 12) {
  const today = kstDay();
  const dow = (new Date(today + 'T00:00:00Z').getUTCDay() + 6) % 7;
  const thisMonday = addDays(today, -dow);
  return Array.from({ length: weeks }, (_, i) => {
    const start = addDays(thisMonday, (i - weeks + 1) * 7), end = addDays(start, 6);
    const w = days.filter((d) => d.day >= start && d.day <= end);
    return { label: `${Number(start.slice(5, 7))}/${Number(start.slice(8, 10))}`, minutes: Math.round(w.reduce((s, d) => s + d.seconds, 0) / 60), completed: w.reduce((s, d) => s + d.completed, 0) };
  });
}

/** 요일 패턴: 최근 12주 요일별 평균 학습 분 */
export function weekdayPattern(days: LearningDay[]) {
  const from = addDays(kstDay(), -83);
  const sums = Array(7).fill(0);
  for (const d of days) if (d.day >= from) sums[(new Date(d.day + 'T00:00:00Z').getUTCDay() + 6) % 7] += d.seconds;
  return ['월', '화', '수', '목', '금', '토', '일'].map((name, i) => ({ name, minutes: Math.round(sums[i] / 60 / 12) }));
}

/** 최근 28일 학습 속도(강/일) */
export function pace(days: LearningDay[]) {
  const from = addDays(kstDay(), -27);
  return days.filter((d) => d.day >= from).reduce((s, d) => s + d.completed, 0) / 28;
}
/** 남은 강의 수 → 예상 완주일 (속도가 없으면 null) */
export function eta(remaining: number, perDay: number) {
  if (remaining <= 0) return kstDay();
  if (perDay <= 0) return null;
  return addDays(kstDay(), Math.ceil(remaining / perDay));
}

/** 오늘의 학습 플랜: 이어보던 강의 → 진행 중 과정의 다음 강의 → 새 과정 첫 강의 */
export function todayPlan(courses: Course[], lessons: Lesson[], progress: Progress[], max = 3) {
  const p = (id: string) => progress.find((x) => x.lesson_id === id);
  const byCourse = (cid: string) => lessons.filter((l) => l.course_id === cid).sort((a, b) => a.position - b.position);
  const out: Lesson[] = [];
  const push = (l?: Lesson) => { if (l && !out.some((x) => x.id === l.id) && !p(l.id)?.complete) out.push(l); };
  [...progress].filter((x) => !x.complete && x.watched > 0).sort((a, b) => b.updated.localeCompare(a.updated)).forEach((x) => push(lessons.find((l) => l.id === x.lesson_id)));
  const ordered = [...courses].sort((a, b) => a.position - b.position);
  for (const c of ordered) { const ls = byCourse(c.id); if (ls.some((l) => p(l.id)?.complete)) push(ls.find((l) => !p(l.id)?.complete)); }
  for (const c of ordered) push(byCourse(c.id).find((l) => !p(l.id)?.complete));
  return out.slice(0, max);
}

/** 이탈 위험 교육생: 승인됨 + (7일 이상 미접속 또는 가입 후 미학습) */
export function atRisk(users: AdminUser[], totalLessons: number, nowMs = Date.now()) {
  const week = new Date(nowMs - 7 * 86400000).toISOString();
  const twoWeeks = new Date(nowMs - 14 * 86400000).toISOString();
  return users
    .filter((u) => u.role === 'student' && u.status === 'active' && u.completed < totalLessons)
    .map((u) => {
      const reason = !u.last_active ? (u.created < week ? '가입 후 학습 기록 없음' : '') : u.last_active < twoWeeks ? '14일 이상 미접속' : u.last_active < week ? '7일 이상 미접속' : u.watched === 0 && u.created < week ? '아직 첫 시청 전' : '';
      return { user: u, reason, level: reason.startsWith('14') || reason.startsWith('가입') ? 2 : 1 };
    })
    .filter((x) => x.reason)
    .sort((a, b) => b.level - a.level || (a.user.last_active || '').localeCompare(b.user.last_active || ''));
}

/** 브라우저 저장소 기반 작은 설정 (답변 템플릿 등) */
export function localGet<T>(key: string, fallback: T): T {
  try { const v = localStorage.getItem(key); return v ? (JSON.parse(v) as T) : fallback; } catch { return fallback; }
}
export function localPut(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* 저장소 사용 불가 */ }
}
