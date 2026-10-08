import { first, all, run, batch, stmt, now, uid, kstDay, HttpError } from '../db';
import { out, str, num } from '../http';
import { passScore, watchRatio } from '../settings';
import { notify, notifyAdmins, logActivity } from '../notify';
import type { AuthedCtx } from './types';

async function publishedLesson(id: string) {
  const lesson = await first<any>('SELECT lessons.* FROM lessons JOIN courses ON courses.id=lessons.course_id WHERE lessons.id=? AND courses.published=1', id);
  if (!lesson) throw new HttpError(404, '강의를 찾을 수 없습니다.');
  return lesson;
}
async function ensureProgress(userId: string, lessonId: string) {
  await run('INSERT OR IGNORE INTO progress (user_id,lesson_id,updated) VALUES (?,?,?)', userId, lessonId, now());
  return (await first<any>('SELECT * FROM progress WHERE user_id=? AND lesson_id=?', userId, lessonId))!;
}

/** 과정의 모든 강의가 완료되면 수료증 발급 + 알림 */
async function maybeIssueCertificate(userId: string, courseId: string, courseTitle: string) {
  const total = await first<{ n: number }>('SELECT COUNT(*) AS n FROM lessons WHERE course_id=?', courseId);
  const done = await first<{ n: number }>('SELECT COUNT(*) AS n FROM progress JOIN lessons ON lessons.id=progress.lesson_id WHERE lessons.course_id=? AND progress.user_id=? AND progress.complete=1', courseId, userId);
  if (!total?.n || done?.n !== total.n) return;
  const exists = await first('SELECT id FROM certificates WHERE user_id=? AND course_id=?', userId, courseId);
  if (exists) return;
  const code = 'SB-' + crypto.getRandomValues(new Uint32Array(2)).reduce((s, v) => s + v.toString(36).toUpperCase(), '').slice(0, 10);
  await run('INSERT INTO certificates (id,user_id,course_id,issued) VALUES (?,?,?,?)', code, userId, courseId, now());
  await notify([userId], 'certificate', `${courseTitle} 과정을 수료했습니다`, '수료증 메뉴에서 수료증을 확인하고 인쇄할 수 있어요.', '/learn/certificates');
  await logActivity(userId, 'certificate', courseTitle);
}

async function markComplete(userId: string, lesson: any, p: any, complete: number) {
  if (complete && !p.complete) {
    await batch([
      stmt('UPDATE progress SET complete=1,completed_at=? WHERE user_id=? AND lesson_id=?', now(), userId, lesson.id),
      stmt('INSERT INTO learning_days (user_id,day,seconds,completed) VALUES (?,?,0,1) ON CONFLICT(user_id,day) DO UPDATE SET completed=learning_days.completed+1', userId, kstDay()),
    ]);
    const course = await first<any>('SELECT title FROM courses WHERE id=?', lesson.course_id);
    await logActivity(userId, 'lesson_complete', lesson.title);
    await maybeIssueCertificate(userId, lesson.course_id, course?.title || '');
  }
}

export async function progress({ body, user, settings }: AuthedCtx) {
  const lesson = await publishedLesson(str(body.lessonId, 100));
  const p = await ensureProgress(user.id, lesson.id);
  const position = Math.max(0, Math.min(num(body.position), lesson.duration));
  const delta = Math.max(0, Math.min(num(body.delta), 15));
  const watched = Math.min(lesson.duration, p.watched + delta);
  const ratio = watchRatio(settings), pass = passScore(settings);
  const complete = watched >= lesson.duration * ratio && (p.score ?? -1) >= pass ? 1 : 0;
  await batch([
    stmt('UPDATE progress SET position=?,watched=?,updated=? WHERE user_id=? AND lesson_id=?', position, watched, now(), user.id, lesson.id),
    ...(delta > 0 ? [stmt('INSERT INTO learning_days (user_id,day,seconds,completed) VALUES (?,?,?,0) ON CONFLICT(user_id,day) DO UPDATE SET seconds=learning_days.seconds+excluded.seconds', user.id, kstDay(), delta)] : []),
  ]);
  await markComplete(user.id, lesson, p, complete);
  return out({ ok: true, watched, complete });
}

export async function bookmark({ body, user }: AuthedCtx) {
  const lesson = await publishedLesson(str(body.lessonId, 100));
  const p = await ensureProgress(user.id, lesson.id);
  await run('UPDATE progress SET bookmark=?,updated=? WHERE user_id=? AND lesson_id=?', p.bookmark ? 0 : 1, now(), user.id, lesson.id);
  return out({ ok: true, bookmark: p.bookmark ? 0 : 1 });
}

export async function note({ body, user }: AuthedCtx) {
  const lesson = await publishedLesson(str(body.lessonId, 100));
  await ensureProgress(user.id, lesson.id);
  await run('UPDATE progress SET note=?,updated=? WHERE user_id=? AND lesson_id=?', String(body.note ?? '').slice(0, 10000), now(), user.id, lesson.id);
  return out({ ok: true });
}

/** 타임스탬프 노트 추가/수정/삭제 */
export async function tnote({ body, user }: AuthedCtx) {
  const lesson = await publishedLesson(str(body.lessonId, 100));
  if (body.remove) {
    await run('DELETE FROM lesson_notes WHERE id=? AND user_id=?', str(body.id, 100), user.id);
    return out({ ok: true });
  }
  const text = str(body.body, 2000);
  if (!text) throw new HttpError(400, '노트 내용을 입력해 주세요.');
  const at = Math.max(0, Math.min(num(body.at), lesson.duration));
  if (body.id) await run('UPDATE lesson_notes SET body=?,at=? WHERE id=? AND user_id=?', text, at, str(body.id, 100), user.id);
  else await run('INSERT INTO lesson_notes (id,user_id,lesson_id,at,body,created) VALUES (?,?,?,?,?,?)', uid(), user.id, lesson.id, at, text, now());
  return out({ ok: true });
}

export async function quiz({ body, user, settings }: AuthedCtx) {
  const lesson = await publishedLesson(str(body.lessonId, 100));
  const p = await ensureProgress(user.id, lesson.id);
  const ratio = watchRatio(settings), pass = passScore(settings);
  if (p.watched < lesson.duration * ratio) throw new HttpError(400, `영상의 ${Math.round(ratio * 100)}% 이상을 시청하면 확인 문제를 풀 수 있습니다.`);
  const qs: any[] = JSON.parse(lesson.questions);
  const answers: number[] = Array.isArray(body.answers) ? body.answers : [];
  const correct = qs.filter((q, i) => q.answer === answers[i]).length;
  const score = qs.length ? Math.round((correct / qs.length) * 100) : 100;
  const best = Math.max(score, p.best_score ?? 0);
  const complete = score >= pass ? 1 : p.complete;
  await run('UPDATE progress SET score=?,best_score=?,attempts=attempts+1,updated=? WHERE user_id=? AND lesson_id=?', score, best, now(), user.id, lesson.id);
  await markComplete(user.id, lesson, p, complete);
  await logActivity(user.id, 'quiz', `${lesson.title} ${score}점`);
  return out({
    ok: true,
    score,
    passed: score >= pass,
    passScore: pass,
    attempts: (p.attempts || 0) + 1,
    bestScore: best,
    results: qs.map((q, i) => ({ correct: q.answer === answers[i], answer: q.answer, explanation: q.explanation })),
  });
}

export async function review({ body, user }: AuthedCtx) {
  const courseId = str(body.courseId, 100);
  const rating = num(body.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new HttpError(400, '별점은 1~5점으로 선택해 주세요.');
  const course = await first('SELECT id FROM courses WHERE id=? AND published=1', courseId);
  if (!course) throw new HttpError(404, '과정을 찾을 수 없습니다.');
  const started = await first('SELECT 1 FROM progress JOIN lessons ON lessons.id=progress.lesson_id WHERE lessons.course_id=? AND progress.user_id=? AND progress.watched>0', courseId, user.id);
  if (!started) throw new HttpError(400, '강의를 시청한 뒤에 후기를 남길 수 있습니다.');
  if (body.remove) {
    await run('DELETE FROM reviews WHERE user_id=? AND course_id=?', user.id, courseId);
    return out({ ok: true });
  }
  await run('INSERT INTO reviews (user_id,course_id,rating,body,created) VALUES (?,?,?,?,?) ON CONFLICT(user_id,course_id) DO UPDATE SET rating=excluded.rating,body=excluded.body,created=excluded.created', user.id, courseId, rating, str(body.body, 1000), now());
  return out({ ok: true });
}

export async function submit({ body, user }: AuthedCtx) {
  const a = await first<any>('SELECT assignments.*, courses.published AS cp FROM assignments JOIN courses ON courses.id=assignments.course_id WHERE assignments.id=? AND assignments.published=1', str(body.assignmentId, 100));
  if (!a || !a.cp) throw new HttpError(404, '과제를 찾을 수 없습니다.');
  const text = str(body.body, 5000), link = str(body.link, 500);
  if (!text && !link) throw new HttpError(400, '과제 내용 또는 링크를 입력해 주세요.');
  if (link && !/^https:\/\//.test(link)) throw new HttpError(400, '링크는 https:// 로 시작해야 합니다.');
  const existing = await first<any>('SELECT id FROM submissions WHERE assignment_id=? AND user_id=?', a.id, user.id);
  if (existing) await run("UPDATE submissions SET body=?,link=?,status='submitted',feedback='',score=NULL,created=?,reviewed='' WHERE id=?", text, link, now(), existing.id);
  else await run('INSERT INTO submissions (id,assignment_id,user_id,body,link,status,created) VALUES (?,?,?,?,?,?,?)', uid(), a.id, user.id, text, link, 'submitted', now());
  await notifyAdmins('assignment', `과제 제출: ${a.title}`, `${user.name}님이 과제를 제출했습니다.`, '/admin/assignments');
  await logActivity(user.id, 'submit', a.title);
  return out({ ok: true });
}

/** 공개 수료증 검증 — 로그인 불필요 */
export async function verifyCertificate(code: string) {
  const c = await first<any>('SELECT certificates.id, certificates.issued, users.name, courses.title FROM certificates JOIN users ON users.id=certificates.user_id JOIN courses ON courses.id=certificates.course_id WHERE certificates.id=?', code.toUpperCase());
  return c;
}

export { all };
