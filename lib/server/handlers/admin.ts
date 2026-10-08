import { first, all, run, batch, stmt, now, uid, chunks, bucket, HttpError } from '../db';
import { out, str, num, bool, siteUrl } from '../http';
import { SETTING_DEFAULTS, setSetting } from '../settings';
import { notify, logActivity } from '../notify';
import { encodePassword } from '../auth';
import type { AuthedCtx } from './types';

import { CATEGORY_META, LEVELS } from '../../constants';
const CATEGORIES = CATEGORY_META.map((c) => c.name);

// ───────── 기수 ─────────
export async function cohort({ body }: AuthedCtx) {
  const name = str(body.name, 60);
  if (!name) throw new HttpError(400, '기수명을 입력해 주세요.');
  if (body.starts && body.ends && body.starts > body.ends) throw new HttpError(400, '종료일은 시작일 이후로 설정해 주세요.');
  if (!['recruiting', 'active', 'completed'].includes(body.status)) throw new HttpError(400, '기수 상태를 확인해 주세요.');
  await run(
    'INSERT INTO cohorts (id,name,starts,ends,description,status) VALUES (?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,starts=excluded.starts,ends=excluded.ends,description=excluded.description,status=excluded.status',
    body.id || uid(), name, str(body.starts, 10), str(body.ends, 10), str(body.description, 1000), body.status,
  );
  return out({ ok: true });
}
export async function cohortDelete({ body }: AuthedCtx) {
  const id = str(body.id, 100);
  await batch([stmt('DELETE FROM memberships WHERE cohort_id=?', id), stmt('UPDATE announcements SET cohort_id=NULL WHERE cohort_id=?', id), stmt('DELETE FROM cohorts WHERE id=?', id)]);
  return out({ ok: true });
}
export async function assignCohort({ body }: AuthedCtx) {
  const ids: string[] = Array.isArray(body.userIds) ? body.userIds : [body.userId];
  if (body.cohortId && !(await first('SELECT id FROM cohorts WHERE id=?', body.cohortId))) throw new HttpError(404, '기수를 찾을 수 없습니다.');
  await batch(
    ids.map((u) =>
      body.cohortId
        ? stmt('INSERT INTO memberships (user_id,cohort_id) VALUES (?,?) ON CONFLICT(user_id) DO UPDATE SET cohort_id=excluded.cohort_id', u, body.cohortId)
        : stmt('DELETE FROM memberships WHERE user_id=?', u),
    ),
  );
  return out({ ok: true });
}

// ───────── 교육생 ─────────
export async function member({ body, user }: AuthedCtx) {
  const ids: string[] = (Array.isArray(body.ids) ? body.ids : [body.id]).filter(Boolean);
  if (ids.includes(user.id)) throw new HttpError(400, '현재 관리자 계정은 변경할 수 없습니다.');
  if (body.status) {
    if (!['active', 'pending', 'suspended'].includes(body.status)) throw new HttpError(400, '잘못된 상태입니다.');
    const before = (await Promise.all(chunks(ids).map((part) => all<any>(`SELECT id,status,name FROM users WHERE id IN (${part.map(() => '?').join(',')})`, ...part)))).flat();
    await batch(ids.map((id) => stmt("UPDATE users SET status=? WHERE id=? AND role='student'", body.status, id)));
    const approved = before.filter((u) => u.status === 'pending' && body.status === 'active').map((u) => u.id);
    if (approved.length) await notify(approved, 'approval', '교육 계정이 승인되었습니다', '지금 바로 나의 강의실에서 학습을 시작하세요.', '/learn');
    await logActivity(user.id, 'member_status', `${ids.length}명 → ${body.status}`);
  }
  if (body.role) {
    if (!['student', 'admin', 'manager'].includes(body.role)) throw new HttpError(400, '잘못된 역할입니다.');
    await batch(ids.map((id) => stmt('UPDATE users SET role=? WHERE id=?', body.role, id)));
    await logActivity(user.id, 'member_role', `${ids.length}명 → ${body.role}`);
  }
  return out({ ok: true });
}
export async function memberDelete({ body, user }: AuthedCtx) {
  const id = str(body.id, 100);
  if (id === user.id) throw new HttpError(400, '현재 계정은 삭제할 수 없습니다.');
  const target = await first<any>('SELECT role FROM users WHERE id=?', id);
  if (!target) throw new HttpError(404, '교육생을 찾을 수 없습니다.');
  await run('DELETE FROM comments WHERE post_id IN (SELECT id FROM posts WHERE user_id=?)', id);
  await run('DELETE FROM post_likes WHERE post_id IN (SELECT id FROM posts WHERE user_id=?)', id);
  await batch(['sessions:user_id', 'user_profiles:user_id', 'progress:user_id', 'lesson_notes:user_id', 'learning_days:user_id', 'memberships:user_id', 'channels:user_id', 'channel_visits:user_id', 'channel_visits:target_id', 'notifications:user_id', 'submissions:user_id', 'reviews:user_id', 'question_votes:user_id', 'oauth_accounts:user_id', 'password_resets:user_id', 'certificates:user_id', 'messages:user_id', 'activity_log:user_id', 'quiz_attempts:user_id', 'event_rsvps:user_id', 'comments:user_id', 'post_likes:user_id', 'posts:user_id', 'users:id'].map((t) => {
    const [table, col] = t.split(':');
    return stmt(`DELETE FROM ${table} WHERE ${col}=?`, id);
  }));
  await logActivity(user.id, 'member_delete', id);
  return out({ ok: true });
}
/** 관리자가 재설정 링크를 생성해 교육생에게 직접 전달 */
export async function resetLink({ req, body }: AuthedCtx) {
  const id = str(body.userId, 100);
  const u = await first<any>('SELECT id FROM users WHERE id=?', id);
  if (!u) throw new HttpError(404, '교육생을 찾을 수 없습니다.');
  const token = uid() + uid();
  await batch([stmt('DELETE FROM password_resets WHERE user_id=?', id), stmt('INSERT INTO password_resets (token,user_id,expires,created) VALUES (?,?,?,?)', token, id, Date.now() + 24 * 3600000, now())]);
  return out({ ok: true, link: `${siteUrl(req)}/reset/${token}` });
}
export async function invite({ body, settings }: AuthedCtx) {
  const email = str(body.email, 200).toLowerCase(), name = str(body.name, 30) || '새 교육생';
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new HttpError(400, '이메일을 확인해 주세요.');
  if (await first('SELECT id FROM users WHERE email=?', email)) throw new HttpError(400, '이미 등록된 이메일입니다.');
  const id = uid();
  await batch([
    stmt('INSERT INTO users (id,email,name,role,password,status,created) VALUES (?,?,?,?,NULL,?,?)', id, email, name, 'student', 'active', now()),
    stmt('INSERT INTO user_profiles (user_id,avatar) VALUES (?,?)', id, crypto.getRandomValues(new Uint32Array(1))[0] % 30),
    ...(body.cohortId ? [stmt('INSERT INTO memberships (user_id,cohort_id) VALUES (?,?)', id, body.cohortId)] : []),
  ]);
  void settings;
  return out({ ok: true, userId: id });
}

/** 교육생별 관리자 메모 */
export async function memo({ body }: AuthedCtx) {
  const id = str(body.userId, 100);
  if (!(await first('SELECT id FROM users WHERE id=?', id))) throw new HttpError(404, '교육생을 찾을 수 없습니다.');
  await run('INSERT INTO user_profiles (user_id,avatar,memo) VALUES (?,?,?) ON CONFLICT(user_id) DO UPDATE SET memo=excluded.memo', id, crypto.getRandomValues(new Uint32Array(1))[0] % 30, str(body.memo, 2000));
  return out({ ok: true });
}
/** 학습 독려·안내 알림을 선택 교육생에게 발송 */
export async function nudge({ body, user }: AuthedCtx) {
  const ids: string[] = (Array.isArray(body.ids) ? body.ids : [body.id]).filter(Boolean).map(String);
  const title = str(body.title, 120), text = str(body.body, 500), link = str(body.link, 200) || '/learn';
  if (!ids.length || !title) throw new HttpError(400, '대상과 제목을 입력해 주세요.');
  if (!link.startsWith('/')) throw new HttpError(400, '링크는 / 로 시작하는 내부 경로여야 합니다.');
  await notify(ids, 'system', title, text, link);
  await logActivity(user.id, 'nudge', `${ids.length}명 · ${title}`);
  return out({ ok: true, count: ids.length });
}

// ───────── 과정 ─────────
export async function course({ body }: AuthedCtx) {
  const title = str(body.title, 120);
  if (!title) throw new HttpError(400, '과정명을 입력해 주세요.');
  await run(
    `INSERT INTO courses (id,title,description,category,image,position,published,level,objectives,instructor) VALUES (?,?,?,?,?,?,?,?,?,?)
     ON CONFLICT(id) DO UPDATE SET title=excluded.title,description=excluded.description,category=excluded.category,image=excluded.image,position=excluded.position,published=excluded.published,level=excluded.level,objectives=excluded.objectives,instructor=excluded.instructor`,
    body.id || uid(), title, str(body.description, 2000), CATEGORIES.includes(body.category) ? body.category : '입문', num(body.image, 1) || 1, num(body.position, 1) || 1, bool(body.published), LEVELS.includes(body.level) ? body.level : '입문', str(body.objectives, 2000), str(body.instructor, 60),
  );
  return out({ ok: true });
}
export async function courseDelete({ body, user }: AuthedCtx) {
  const id = str(body.id, 100);
  const lessons = await all<{ id: string }>('SELECT id FROM lessons WHERE course_id=?', id);
  const lids = lessons.map((l) => l.id);
  await purgeLessonFiles(lids);
  const perLesson = (table: string) => chunks(lids).map((part) => stmt(`DELETE FROM ${table} WHERE lesson_id IN (${part.map(() => '?').join(',')})`, ...part));
  await batch([
    ...perLesson('progress'), ...perLesson('lesson_notes'), ...perLesson('quiz_attempts'),
    ...chunks(lids).map((part) => stmt(`UPDATE messages SET lesson_id=NULL WHERE lesson_id IN (${part.map(() => '?').join(',')})`, ...part)),
    stmt('DELETE FROM submissions WHERE assignment_id IN (SELECT id FROM assignments WHERE course_id=?)', id),
    stmt('DELETE FROM assignments WHERE course_id=?', id),
    stmt('DELETE FROM reviews WHERE course_id=?', id),
    stmt('DELETE FROM lessons WHERE course_id=?', id),
    stmt('DELETE FROM courses WHERE id=?', id),
  ]);
  // 학습 경로에서 삭제된 과정 제거
  const paths = await all<{ id: string; courses: string }>('SELECT id, courses FROM paths WHERE courses LIKE ?', '%' + id + '%');
  for (const p of paths) {
    let list: string[] = [];
    try { list = JSON.parse(p.courses); } catch {}
    await run('UPDATE paths SET courses=? WHERE id=?', JSON.stringify(list.filter((c) => c !== id)), p.id);
  }
  await logActivity(user.id, 'course_delete', id);
  return out({ ok: true });
}
export async function courseDuplicate({ body }: AuthedCtx) {
  const c = await first<any>('SELECT * FROM courses WHERE id=?', str(body.id, 100));
  if (!c) throw new HttpError(404, '과정을 찾을 수 없습니다.');
  const nid = uid();
  const maxPos = await first<{ m: number }>('SELECT COALESCE(MAX(position),0) AS m FROM courses');
  const lessons = await all<any>('SELECT * FROM lessons WHERE course_id=? ORDER BY position', c.id);
  await batch([
    stmt('INSERT INTO courses (id,title,description,category,image,position,published,level,objectives,instructor) VALUES (?,?,?,?,?,?,0,?,?,?)', nid, c.title + ' (복사본)', c.description, c.category, c.image, (maxPos?.m || 0) + 1, c.level, c.objectives, c.instructor),
    ...lessons.map((l) => stmt('INSERT INTO lessons (id,course_id,title,summary,duration,position,video,questions,resource,section,chapters,objectives,transcript,preview) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)', uid(), nid, l.title, l.summary, l.duration, l.position, l.video, l.questions, l.resource, l.section, l.chapters, l.objectives, l.transcript, l.preview)),
  ]);
  return out({ ok: true, id: nid });
}
export async function reorder({ body }: AuthedCtx) {
  const table = body.table === 'lessons' ? 'lessons' : body.table === 'assignments' ? 'assignments' : 'courses';
  const ids: string[] = Array.isArray(body.ids) ? body.ids.map(String) : [];
  if (!ids.length) throw new HttpError(400, '순서 정보가 없습니다.');
  await batch(ids.map((id, i) => stmt(`UPDATE ${table} SET position=? WHERE id=?`, i + 1, id)));
  return out({ ok: true });
}

// ───────── 강의 ─────────
function parseQuestions(raw: unknown) {
  let qs: any;
  try {
    qs = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!Array.isArray(qs) || !qs.length || qs.some((q: any) => !q.question || !Array.isArray(q.options) || q.options.length < 2 || !Number.isInteger(q.answer) || q.answer < 0 || q.answer >= q.options.length)) throw 0;
  } catch {
    throw new HttpError(400, '확인 문제와 정답을 확인해 주세요. 문제마다 보기 2개 이상과 정답이 필요합니다.');
  }
  return qs.map((q: any) => ({ question: str(q.question, 500), options: q.options.map((o: any) => str(o, 300)), answer: q.answer, explanation: str(q.explanation, 1000) }));
}
function parseChapters(raw: unknown, duration: number) {
  let ch: any;
  try {
    ch = typeof raw === 'string' ? JSON.parse(raw || '[]') : raw || [];
    if (!Array.isArray(ch)) throw 0;
  } catch {
    throw new HttpError(400, '챕터 형식을 확인해 주세요.');
  }
  return ch
    .map((c: any) => ({ at: Math.max(0, Math.min(num(c.at), duration)), title: str(c.title, 100) }))
    .filter((c: any) => c.title)
    .sort((a: any, b: any) => a.at - b.at);
}
export async function lesson({ body }: AuthedCtx) {
  const title = str(body.title, 120);
  if (!title || !body.course_id) throw new HttpError(400, '과정과 영상 제목을 입력해 주세요.');
  const video = str(body.video, 1000);
  if (video && video !== '/sample-intro.mp4' && !video.startsWith('/api/media/') && !/^https:\/\//.test(video)) throw new HttpError(400, 'HTTPS 영상 주소를 입력해 주세요.');
  const duration = Math.max(1, num(body.duration, 600) || 600);
  const qs = parseQuestions(body.questions);
  const chapters = parseChapters(body.chapters, duration);
  await run(
    `INSERT INTO lessons (id,course_id,title,summary,duration,position,video,questions,resource,section,chapters,objectives,transcript,preview) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
     ON CONFLICT(id) DO UPDATE SET course_id=excluded.course_id,title=excluded.title,summary=excluded.summary,duration=excluded.duration,position=excluded.position,video=excluded.video,questions=excluded.questions,resource=excluded.resource,section=excluded.section,chapters=excluded.chapters,objectives=excluded.objectives,transcript=excluded.transcript,preview=excluded.preview`,
    body.id || uid(), body.course_id, title, str(body.summary, 2000), duration, num(body.position, 1) || 1, video, JSON.stringify(qs), str(body.resource, 20000), str(body.section, 60), JSON.stringify(chapters), str(body.objectives, 2000), str(body.transcript, 50000), bool(body.preview),
  );
  return out({ ok: true });
}
export async function lessonDelete({ body, user }: AuthedCtx) {
  const id = str(body.id, 100);
  await purgeLessonFiles([id]);
  await batch([stmt('DELETE FROM progress WHERE lesson_id=?', id), stmt('DELETE FROM lesson_notes WHERE lesson_id=?', id), stmt('DELETE FROM quiz_attempts WHERE lesson_id=?', id), stmt('UPDATE messages SET lesson_id=NULL WHERE lesson_id=?', id), stmt('UPDATE assignments SET lesson_id=NULL WHERE lesson_id=?', id), stmt('DELETE FROM lessons WHERE id=?', id)]);
  await logActivity(user.id, 'lesson_delete', id);
  return out({ ok: true });
}
/** JSON 배열로 강의 일괄 등록 */
export async function lessonsImport({ body }: AuthedCtx) {
  const courseId = str(body.course_id, 100);
  if (!(await first('SELECT id FROM courses WHERE id=?', courseId))) throw new HttpError(404, '과정을 찾을 수 없습니다.');
  let items: any[];
  try {
    items = typeof body.items === 'string' ? JSON.parse(body.items) : body.items;
    if (!Array.isArray(items) || !items.length) throw 0;
  } catch {
    throw new HttpError(400, '강의 목록 JSON 배열을 확인해 주세요.');
  }
  const start = (await first<{ m: number }>('SELECT COALESCE(MAX(position),0) AS m FROM lessons WHERE course_id=?', courseId))?.m || 0;
  const statements = items.slice(0, 100).map((it, i) => {
    const title = str(it.title, 120);
    if (!title) throw new HttpError(400, `${i + 1}번째 항목에 제목이 없습니다.`);
    const duration = Math.max(1, num(it.duration, 600) || 600);
    const qs = it.questions ? parseQuestions(it.questions) : [{ question: `${title}의 핵심 내용은 무엇인가요?`, options: ['강의에서 설명한 핵심 원칙', '관련 없는 내용'], answer: 0, explanation: '강의 내용을 다시 확인해 보세요.' }];
    return stmt('INSERT INTO lessons (id,course_id,title,summary,duration,position,video,questions,resource,section,chapters,objectives) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)', uid(), courseId, title, str(it.summary, 2000), duration, start + i + 1, str(it.video, 1000), JSON.stringify(qs), str(it.resource, 20000), str(it.section, 60), JSON.stringify(parseChapters(it.chapters, duration)), str(it.objectives, 2000));
  });
  await batch(statements);
  return out({ ok: true, count: statements.length });
}

// ───────── Q&A ─────────
export async function reply({ body, user }: AuthedCtx) {
  const id = str(body.id, 100), text = str(body.reply, 5000);
  const m = await first<any>('SELECT user_id, lesson_id FROM messages WHERE id=?', id);
  if (!m) throw new HttpError(404, '질문을 찾을 수 없습니다.');
  await run('UPDATE messages SET reply=?, resolved=1 WHERE id=?', text, id);
  const lesson = m.lesson_id ? await first<any>('SELECT title FROM lessons WHERE id=?', m.lesson_id) : null;
  if (text) await notify([m.user_id], 'reply', '질문에 답변이 등록되었습니다', lesson?.title || '학습 문의', m.lesson_id ? `/lesson/${m.lesson_id}` : '/learn/questions');
  await logActivity(user.id, 'reply', id);
  return out({ ok: true });
}
export async function questionUpdate({ body }: AuthedCtx) {
  const id = str(body.id, 100);
  const sets: string[] = [], vals: unknown[] = [];
  for (const k of ['pinned', 'resolved', 'public']) if (body[k] !== undefined) { sets.push(`${k}=?`); vals.push(bool(body[k])); }
  if (!sets.length) throw new HttpError(400, '변경할 항목이 없습니다.');
  await run(`UPDATE messages SET ${sets.join(',')} WHERE id=?`, ...vals, id);
  return out({ ok: true });
}

// ───────── 공지 ─────────
export async function announcement({ body, user }: AuthedCtx) {
  const title = str(body.title, 120), text = str(body.body, 10000);
  if (!title || !text) throw new HttpError(400, '제목과 내용을 입력해 주세요.');
  const cohortId = body.cohortId ? str(body.cohortId, 100) : null;
  const id = body.id || uid();
  const isNew = !body.id;
  await run(
    'INSERT INTO announcements (id,title,body,cohort_id,pinned,author_id,created) VALUES (?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title,body=excluded.body,cohort_id=excluded.cohort_id,pinned=excluded.pinned',
    id, title, text, cohortId, bool(body.pinned), user.id, now(),
  );
  if (isNew && body.notify !== false) {
    const targets = await all<{ id: string }>(
      cohortId ? `SELECT users.id FROM users JOIN memberships ON memberships.user_id=users.id WHERE users.status='active' AND users.role='student' AND memberships.cohort_id=?` : `SELECT id FROM users WHERE status='active' AND role='student'`,
      ...(cohortId ? [cohortId] : []),
    );
    await notify(targets.map((t) => t.id), 'announcement', title, text.slice(0, 120), '/learn/notices');
  }
  return out({ ok: true });
}
export async function announcementDelete({ body }: AuthedCtx) {
  await run('DELETE FROM announcements WHERE id=?', str(body.id, 100));
  return out({ ok: true });
}

// ───────── 과제 ─────────
export async function assignment({ body }: AuthedCtx) {
  const title = str(body.title, 120);
  if (!title || !body.courseId) throw new HttpError(400, '과정과 과제 제목을 입력해 주세요.');
  await run(
    `INSERT INTO assignments (id,course_id,lesson_id,title,description,due,position,published,created) VALUES (?,?,?,?,?,?,?,?,?)
     ON CONFLICT(id) DO UPDATE SET course_id=excluded.course_id,lesson_id=excluded.lesson_id,title=excluded.title,description=excluded.description,due=excluded.due,position=excluded.position,published=excluded.published`,
    body.id || uid(), str(body.courseId, 100), body.lessonId ? str(body.lessonId, 100) : null, title, str(body.description, 10000), str(body.due, 10), num(body.position, 1) || 1, bool(body.published), now(),
  );
  return out({ ok: true });
}
export async function assignmentDelete({ body }: AuthedCtx) {
  const id = str(body.id, 100);
  await batch([stmt('DELETE FROM submissions WHERE assignment_id=?', id), stmt('DELETE FROM assignments WHERE id=?', id)]);
  return out({ ok: true });
}
export async function reviewSubmission({ body, user }: AuthedCtx) {
  const id = str(body.id, 100);
  if (!['passed', 'revise', 'submitted'].includes(body.status)) throw new HttpError(400, '검토 상태를 확인해 주세요.');
  const s = await first<any>('SELECT submissions.user_id, assignments.title FROM submissions JOIN assignments ON assignments.id=submissions.assignment_id WHERE submissions.id=?', id);
  if (!s) throw new HttpError(404, '제출물을 찾을 수 없습니다.');
  const score = body.score === '' || body.score === null || body.score === undefined ? null : Math.max(0, Math.min(100, num(body.score)));
  await run('UPDATE submissions SET status=?,feedback=?,score=?,reviewed=? WHERE id=?', body.status, str(body.feedback, 5000), score, now(), id);
  await notify([s.user_id], 'assignment', body.status === 'passed' ? `과제 통과: ${s.title}` : `과제 피드백: ${s.title}`, str(body.feedback, 120), '/learn/assignments');
  await logActivity(user.id, 'review_submission', s.title);
  return out({ ok: true });
}

// ───────── 설정 ─────────
export async function settings({ body }: AuthedCtx) {
  for (const id of Object.keys(SETTING_DEFAULTS)) {
    if (body[id] === undefined) continue;
    let v = str(body[id], 500);
    if (id === 'pass_score') v = String(Math.min(100, Math.max(1, num(v, 80) || 80)));
    if (id === 'watch_ratio') v = String(Math.min(100, Math.max(10, num(v, 90) || 90)));
    if (id === 'max_video_mb') v = String(Math.min(200, Math.max(5, num(v, 50) || 50)));
    if (['auto_approve', 'oauth_auto_approve', 'demo_mode'].includes(id)) v = v === '1' ? '1' : '0';
    // 비밀 값은 빈 문자열이면 유지
    if (['kakao_secret', 'naver_secret', 'resend_key'].includes(id) && !v) continue;
    await setSetting(id, v);
  }
  if (body.ai_key) await setSetting('ai_key', str(body.ai_key, 500));
  for (const k of ['ai_key', 'kakao_secret', 'naver_secret', 'resend_key']) if (body['clear_' + k]) await run('DELETE FROM settings WHERE id=?', k);
  return out({ ok: true });
}

// ───────── 학습 경로 ─────────
export async function path({ body }: AuthedCtx) {
  const title = str(body.title, 120);
  if (!title) throw new HttpError(400, '경로 이름을 입력해 주세요.');
  let courses: string[] = [];
  try { courses = (typeof body.courses === 'string' ? JSON.parse(body.courses) : body.courses || []).map(String); } catch { throw new HttpError(400, '과정 목록을 확인해 주세요.'); }
  const valid = await all<{ id: string }>('SELECT id FROM courses');
  courses = courses.filter((c) => valid.some((v) => v.id === c));
  if (!courses.length) throw new HttpError(400, '과정을 1개 이상 선택해 주세요.');
  await run('INSERT INTO paths (id,title,description,courses,position,published,created) VALUES (?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title,description=excluded.description,courses=excluded.courses,position=excluded.position,published=excluded.published',
    body.id || uid(), title, str(body.description, 2000), JSON.stringify(courses), num(body.position, 1) || 1, bool(body.published), now());
  return out({ ok: true });
}
export async function pathDelete({ body }: AuthedCtx) {
  await run('DELETE FROM paths WHERE id=?', str(body.id, 100));
  return out({ ok: true });
}

// ───────── 라이브 세션·일정 ─────────
export async function event({ body, user }: AuthedCtx) {
  const title = str(body.title, 120), starts = str(body.starts, 30);
  if (!title || !starts) throw new HttpError(400, '제목과 시작 일시를 입력해 주세요.');
  const link = str(body.link, 500);
  if (link && !/^https?:\/\//.test(link)) throw new HttpError(400, '세션 링크는 http(s):// 로 시작해야 합니다.');
  const cohortId = body.cohortId ? str(body.cohortId, 100) : null;
  const id = body.id || uid();
  const isNew = !body.id;
  await run('INSERT INTO events (id,title,description,starts,ends,link,location,cohort_id,capacity,created_by,created) VALUES (?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title,description=excluded.description,starts=excluded.starts,ends=excluded.ends,link=excluded.link,location=excluded.location,cohort_id=excluded.cohort_id,capacity=excluded.capacity',
    id, title, str(body.description, 5000), starts, str(body.ends, 30), link, str(body.location, 200), cohortId, Math.max(0, num(body.capacity, 0)), user.id, now());
  if (isNew && body.notify !== false) {
    const targets = await all<{ id: string }>(cohortId ? `SELECT users.id FROM users JOIN memberships ON memberships.user_id=users.id WHERE users.status='active' AND users.role='student' AND memberships.cohort_id=?` : `SELECT id FROM users WHERE status='active' AND role='student'`, ...(cohortId ? [cohortId] : []));
    await notify(targets.map((t) => t.id), 'system', `새 일정: ${title}`, `${starts.replace('T', ' ')} · 일정 메뉴에서 참석 신청하세요.`, '/learn/events');
  }
  return out({ ok: true, id });
}
export async function eventDelete({ body }: AuthedCtx) {
  const id = str(body.id, 100);
  await batch([stmt('DELETE FROM event_rsvps WHERE event_id=?', id), stmt('DELETE FROM events WHERE id=?', id)]);
  return out({ ok: true });
}
/** 참석 신청자에게 리마인드 */
export async function eventRemind({ body }: AuthedCtx) {
  const id = str(body.id, 100);
  const ev = await first<any>('SELECT * FROM events WHERE id=?', id);
  if (!ev) throw new HttpError(404, '일정을 찾을 수 없습니다.');
  const ids = (await all<{ user_id: string }>('SELECT user_id FROM event_rsvps WHERE event_id=?', id)).map((r) => r.user_id);
  await notify(ids, 'system', `곧 시작: ${ev.title}`, `${ev.starts.replace('T', ' ')}${ev.link ? ' · 링크: ' + ev.link : ''}`, '/learn/events');
  return out({ ok: true, count: ids.length });
}

// ───────── FAQ ─────────
export async function faq({ body }: AuthedCtx) {
  const q = str(body.question, 300), a = str(body.answer, 3000);
  if (!q || !a) throw new HttpError(400, '질문과 답변을 입력해 주세요.');
  await run('INSERT INTO faqs (id,question,answer,position,published) VALUES (?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET question=excluded.question,answer=excluded.answer,position=excluded.position,published=excluded.published', body.id || uid(), q, a, num(body.position, 1) || 1, body.published === undefined ? 1 : bool(body.published));
  return out({ ok: true });
}
export async function faqDelete({ body }: AuthedCtx) {
  await run('DELETE FROM faqs WHERE id=?', str(body.id, 100));
  return out({ ok: true });
}

// ───────── 교육생 CSV 일괄 등록 ─────────
export async function inviteBulk({ body }: AuthedCtx) {
  const lines = String(body.csv || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean).slice(0, 300);
  const cohorts = await all<{ id: string; name: string }>('SELECT id,name FROM cohorts');
  const defaultCohort = body.cohortId ? str(body.cohortId, 100) : '';
  const results: { email: string; ok: boolean; reason?: string }[] = [];
  const statements: D1PreparedStatement[] = [];
  const seen = new Set<string>();
  const candidates = lines.map((l) => (l.split(/[,\t;]/)[1] || l.split(/[,\t;]/)[0] || '').trim().replace(/^"|"$/g, '').toLowerCase()).filter((e) => e.includes('@'));
  const existingEmails = new Set((await Promise.all(chunks(candidates).map((part) => all<{ email: string }>(`SELECT email FROM users WHERE email IN (${part.map(() => '?').join(',')})`, ...part)))).flat().map((r) => r.email));
  for (const line of lines) {
    const [rawName, rawEmail, rawCohort] = line.split(/[,\t;]/).map((x) => (x || '').trim().replace(/^"|"$/g, ''));
    const email = (rawEmail || rawName || '').toLowerCase();
    const name = rawEmail ? rawName : email.split('@')[0];
    if (!/^\S+@\S+\.\S+$/.test(email)) { results.push({ email: line, ok: false, reason: '이메일 형식' }); continue; }
    if (seen.has(email)) { results.push({ email, ok: false, reason: '중복' }); continue; }
    seen.add(email);
    if (existingEmails.has(email)) { results.push({ email, ok: false, reason: '이미 등록됨' }); continue; }
    const cohortId = cohorts.find((c) => c.name === rawCohort || c.id === rawCohort)?.id || defaultCohort;
    const id = uid();
    statements.push(stmt('INSERT INTO users (id,email,name,role,password,status,created) VALUES (?,?,?,?,NULL,?,?)', id, email, (name || '새 교육생').slice(0, 30), 'student', 'active', now())); // 비밀번호는 재설정 링크로 설정
    statements.push(stmt('INSERT INTO user_profiles (user_id,avatar) VALUES (?,?)', id, crypto.getRandomValues(new Uint32Array(1))[0] % 30));
    if (cohortId) statements.push(stmt('INSERT INTO memberships (user_id,cohort_id) VALUES (?,?)', id, cohortId));
    results.push({ email, ok: true });
  }
  await batch(statements);
  return out({ ok: true, created: results.filter((r) => r.ok).length, results });
}

// ───────── 강의 자료 파일 ─────────
/** 강의 삭제 시 첨부 파일 레코드와 R2 객체 정리 */
async function purgeLessonFiles(lessonIds: string[]) {
  if (!lessonIds.length) return;
  const files = (await Promise.all(chunks(lessonIds).map((part) => all<{ id: string; key: string }>(`SELECT id,key FROM lesson_files WHERE lesson_id IN (${part.map(() => '?').join(',')})`, ...part)))).flat();
  const b = bucket();
  for (const f of files) { try { await b?.delete(f.key); } catch {} }
  await batch(chunks(lessonIds).map((part) => stmt(`DELETE FROM lesson_files WHERE lesson_id IN (${part.map(() => '?').join(',')})`, ...part)));
}
export async function lessonFileDelete({ body }: AuthedCtx) {
  const id = str(body.id, 100);
  const f = await first<any>('SELECT key FROM lesson_files WHERE id=?', id);
  if (!f) throw new HttpError(404, '파일을 찾을 수 없습니다.');
  await run('DELETE FROM lesson_files WHERE id=?', id);
  try { await bucket()?.delete(f.key); } catch {}
  return out({ ok: true });
}

// ───────── 콘텐츠 내보내기/가져오기 (최고 관리자) ─────────
export async function exportContent() {
  const [courses, lessons, assignments, faqs, paths] = await Promise.all([all('SELECT * FROM courses ORDER BY position'), all('SELECT * FROM lessons ORDER BY course_id, position'), all('SELECT * FROM assignments ORDER BY position'), all('SELECT * FROM faqs ORDER BY position'), all('SELECT * FROM paths ORDER BY position')]);
  return { version: 1, exported: now(), courses, lessons, assignments, faqs, paths };
}
export async function importContent({ body, user }: AuthedCtx) {
  let data: any;
  try { data = typeof body.data === 'string' ? JSON.parse(body.data) : body.data; if (!data || !Array.isArray(data.courses)) throw 0; } catch { throw new HttpError(400, '내보내기 JSON 형식을 확인해 주세요.'); }
  const sts: D1PreparedStatement[] = [];
  for (const c of data.courses.slice(0, 200)) sts.push(stmt('INSERT INTO courses (id,title,description,category,image,position,published,level,objectives,instructor) VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title,description=excluded.description,category=excluded.category,image=excluded.image,position=excluded.position,published=excluded.published,level=excluded.level,objectives=excluded.objectives,instructor=excluded.instructor', String(c.id || uid()), str(c.title, 120), str(c.description, 2000), str(c.category, 30) || '입문', num(c.image, 1) || 1, num(c.position, 1) || 1, bool(c.published ?? 1), str(c.level, 10) || '입문', str(c.objectives, 2000), str(c.instructor, 60)));
  for (const l of (data.lessons || []).slice(0, 1000)) sts.push(stmt('INSERT INTO lessons (id,course_id,title,summary,duration,position,video,questions,resource,section,chapters,objectives,transcript,preview) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET course_id=excluded.course_id,title=excluded.title,summary=excluded.summary,duration=excluded.duration,position=excluded.position,video=excluded.video,questions=excluded.questions,resource=excluded.resource,section=excluded.section,chapters=excluded.chapters,objectives=excluded.objectives,transcript=excluded.transcript,preview=excluded.preview', String(l.id || uid()), String(l.course_id), str(l.title, 120), str(l.summary, 2000), Math.max(1, num(l.duration, 600)), num(l.position, 1) || 1, str(l.video, 1000), typeof l.questions === 'string' ? l.questions : JSON.stringify(l.questions || []), str(l.resource, 20000), str(l.section, 60), typeof l.chapters === 'string' ? l.chapters : JSON.stringify(l.chapters || []), str(l.objectives, 2000), str(l.transcript, 50000), bool(l.preview)));
  for (const a of (data.assignments || []).slice(0, 300)) sts.push(stmt('INSERT INTO assignments (id,course_id,lesson_id,title,description,due,position,published,created) VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET course_id=excluded.course_id,lesson_id=excluded.lesson_id,title=excluded.title,description=excluded.description,due=excluded.due,position=excluded.position,published=excluded.published', String(a.id || uid()), String(a.course_id), a.lesson_id || null, str(a.title, 120), str(a.description, 10000), str(a.due, 10), num(a.position, 1) || 1, bool(a.published ?? 1), a.created || now()));
  for (const f of (data.faqs || []).slice(0, 200)) sts.push(stmt('INSERT INTO faqs (id,question,answer,position,published) VALUES (?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET question=excluded.question,answer=excluded.answer,position=excluded.position,published=excluded.published', String(f.id || uid()), str(f.question, 300), str(f.answer, 3000), num(f.position, 1) || 1, bool(f.published ?? 1)));
  for (const p of (data.paths || []).slice(0, 100)) sts.push(stmt('INSERT INTO paths (id,title,description,courses,position,published,created) VALUES (?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title,description=excluded.description,courses=excluded.courses,position=excluded.position,published=excluded.published', String(p.id || uid()), str(p.title, 120), str(p.description, 2000), typeof p.courses === 'string' ? p.courses : JSON.stringify(p.courses || []), num(p.position, 1) || 1, bool(p.published ?? 1), p.created || now()));
  for (let i = 0; i < sts.length; i += 60) await batch(sts.slice(i, i + 60));
  await logActivity(user.id, 'content_import', `${sts.length}건`);
  return out({ ok: true, count: sts.length });
}
