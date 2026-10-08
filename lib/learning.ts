import type { Course, LearningDay, Lesson, Progress } from './types';

export const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
export const fmtLong = (s: number) => {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  return h ? `${h}시간 ${m}분` : `${m}분`;
};
export const fmtDate = (iso: string) => (iso ? new Date(iso).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' }) : '');
export const fmtShort = (iso: string) => (iso ? iso.slice(0, 10).replace(/-/g, '.') : '');
export const relTime = (iso: string) => {
  const d = (Date.now() - new Date(iso).getTime()) / 1000;
  if (d < 60) return '방금';
  if (d < 3600) return `${Math.floor(d / 60)}분 전`;
  if (d < 86400) return `${Math.floor(d / 3600)}시간 전`;
  if (d < 86400 * 7) return `${Math.floor(d / 86400)}일 전`;
  return fmtShort(iso);
};

/** KST 기준 YYYY-MM-DD */
export const kstDay = (d = new Date()) => new Date(d.getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10);
export const addDays = (day: string, n: number) => {
  const d = new Date(day + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/** 연속 학습일 — 오늘 또는 어제부터 거꾸로 센다 */
export function streak(days: LearningDay[]) {
  const set = new Set(days.filter((d) => d.seconds >= 60 || d.completed > 0).map((d) => d.day));
  let day = kstDay();
  if (!set.has(day)) day = addDays(day, -1);
  let n = 0;
  while (set.has(day)) {
    n++;
    day = addDays(day, -1);
  }
  return n;
}

/** 이번 주(월~일) 완료 강의 수와 학습 시간 */
export function thisWeek(days: LearningDay[]) {
  const today = kstDay();
  const dow = (new Date(today + 'T00:00:00Z').getUTCDay() + 6) % 7; // 월=0
  const monday = addDays(today, -dow);
  const week = days.filter((d) => d.day >= monday && d.day <= today);
  return { monday, completed: week.reduce((s, d) => s + d.completed, 0), seconds: week.reduce((s, d) => s + d.seconds, 0), days: week.length };
}

/** 최근 N주 히트맵 격자 (주 단위, 월요일 시작) */
export function heatmap(days: LearningDay[], weeks = 16) {
  const map = new Map(days.map((d) => [d.day, d]));
  const today = kstDay();
  const dow = (new Date(today + 'T00:00:00Z').getUTCDay() + 6) % 7;
  const start = addDays(today, -(dow + (weeks - 1) * 7));
  const cells: { day: string; seconds: number; completed: number; future: boolean }[] = [];
  for (let i = 0; i < weeks * 7; i++) {
    const day = addDays(start, i);
    const d = map.get(day);
    cells.push({ day, seconds: d?.seconds || 0, completed: d?.completed || 0, future: day > today });
  }
  return cells;
}

export function coursePct(course: Course | undefined, lessons: Lesson[], progress: Progress[]) {
  if (!course) return 0;
  const items = lessons.filter((l) => l.course_id === course.id);
  if (!items.length) return 0;
  return Math.round((items.filter((l) => progress.some((p) => p.lesson_id === l.id && p.complete)).length / items.length) * 100);
}

export interface Badge { id: string; name: string; desc: string; earned: boolean; icon: string }
export function badges(progress: Progress[], days: LearningDay[], certificates: number, notesCount: number, questions: number): Badge[] {
  const done = progress.filter((p) => p.complete).length;
  const watched = progress.reduce((s, p) => s + p.watched, 0);
  const st = streak(days);
  const perfect = progress.some((p) => (p.best_score ?? 0) === 100);
  return [
    { id: 'first', name: '첫 걸음', desc: '첫 강의 완료', earned: done >= 1, icon: '🚀' },
    { id: 'five', name: '꾸준한 셀러', desc: '강의 5개 완료', earned: done >= 5, icon: '📚' },
    { id: 'ten', name: '성장하는 셀러', desc: '강의 10개 완료', earned: done >= 10, icon: '🌱' },
    { id: 'hour', name: '집중 1시간', desc: '누적 1시간 시청', earned: watched >= 3600, icon: '⏱️' },
    { id: 'streak3', name: '3일 연속', desc: '3일 연속 학습', earned: st >= 3, icon: '🔥' },
    { id: 'streak7', name: '일주일 루틴', desc: '7일 연속 학습', earned: st >= 7, icon: '🏅' },
    { id: 'perfect', name: '만점', desc: '확인 문제 100점', earned: perfect, icon: '💯' },
    { id: 'note', name: '기록하는 습관', desc: '학습 노트 5개', earned: notesCount >= 5, icon: '📝' },
    { id: 'ask', name: '질문하는 셀러', desc: '질문 1개 이상', earned: questions >= 1, icon: '💬' },
    { id: 'cert', name: '수료', desc: '과정 1개 수료', earned: certificates >= 1, icon: '🎓' },
  ];
}

export const platformMark: Record<string, string> = { youtube: '▶', instagram: '◎', tiktok: '♪', x: 'X', naver: 'N' };
export const platformName: Record<string, string> = { youtube: 'YouTube', instagram: 'Instagram', tiktok: 'TikTok', x: 'X', naver: '네이버' };
export { PLATFORMS, CATEGORIES, LEVELS } from './constants';

export function downloadText(name: string, text: string, type = 'text/plain;charset=utf-8') {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}
export function downloadCsv(name: string, rows: (string | number | null | undefined)[][]) {
  const csv = '﻿' + rows.map((r) => r.map((v) => '"' + String(v ?? '').replace(/"/g, '""') + '"').join(',')).join('\r\n');
  downloadText(name, csv, 'text/csv;charset=utf-8');
}
