#!/usr/bin/env node
/**
 * 셀러브릭스 에듀 API 회귀 점검
 * 사용: 서버를 띄운 뒤  node scripts/smoke-test.mjs [http://127.0.0.1:3040]
 * 체험 계정(demo)을 사용하므로 로컬/스테이징에서만 실행하세요.
 */
const BASE = process.argv[2] || 'http://127.0.0.1:3040';
let pass = 0, fail = 0;
const jar = {};
const client = (name) => ({
  async call(action, extra = {}) {
    const r = await fetch(BASE + '/api/edu', { method: 'POST', headers: { 'Content-Type': 'application/json', cookie: jar[name] || '' }, body: JSON.stringify({ action, ...extra }) });
    const sc = r.headers.get('set-cookie');
    if (sc) jar[name] = sc.split(';')[0];
    return { status: r.status, json: await r.json().catch(() => ({})) };
  },
  async get(q = '') {
    const r = await fetch(BASE + '/api/edu' + q, { headers: { cookie: jar[name] || '' } });
    return { status: r.status, json: await r.json().catch(() => ({})), headers: r.headers };
  },
});
function check(label, ok, detail = '') {
  if (ok) pass++; else fail++;
  console.log(`${ok ? '✓' : '✗'} ${label}${detail ? ' — ' + detail : ''}`);
}
const S = client('student'), A = client('admin'), X = client('anon');

// ── 공개
let r = await X.get();
check('비로그인 GET 200', r.status === 200 && Array.isArray(r.json.courses), `courses=${r.json.courses?.length} lessons=${r.json.lessons?.length}`);
check('비로그인 응답에 진도·메시지 없음', r.json.progress?.length === 0 && r.json.messages?.length === 0);
check('비로그인에 비공개 강의 본문(대본·자료) 미노출', r.json.lessons.filter((l) => !l.preview).every((l) => !l.transcript && !l.resource && l.video !== '/sample-intro.mp4'));
check('비로그인에 비밀 설정 미노출', !('kakao_client' in r.json.settings) && !('mail_from' in r.json.settings));
const etag = r.headers.get('etag');
check('ETag 제공', !!etag);
r = await fetch(BASE + '/api/edu', { headers: { 'If-None-Match': etag } });
check('If-None-Match → 304', r.status === 304);
r = await X.call('nope');
check('알 수 없는 액션 400', r.status === 400);
r = await X.call('progress', { lessonId: 'start-1' });
check('비로그인 보호 액션 401', r.status === 401);

// ── 로그인
r = await S.call('demo', { role: 'student' });
check('교육생 체험 로그인', r.status === 200 && r.json.user?.role === 'student');
r = await A.call('demo', { role: 'admin' });
check('관리자 체험 로그인', r.status === 200 && r.json.user?.role === 'admin');
r = await S.call('settings', { pass_score: '1' });
check('교육생이 관리자 액션 → 403', r.status === 403);

// ── 학습 흐름 (영상 강의)
const data = (await S.get()).json;
const videoLesson = data.lessons.find((l) => l.video);
const readingLesson = data.lessons.find((l) => !l.video);
if (videoLesson) {
  // 서버는 벽시계 기준으로 시청 시간을 상한(경과초×2+3)하므로 실제 플레이어처럼 작은 delta 를 여러 번 보낸다
  await S.call('progress_reset', { courseId: videoLesson.course_id });
  r = await S.call('progress', { lessonId: videoLesson.id, position: 1, delta: 15 });
  check('시청 시간 상한(즉시 15초 요청 → 약 3초만 인정)', r.status === 200 && r.json.watched <= 5, `watched=${r.json.watched}`);
  for (let i = 0; i < Math.ceil((videoLesson.duration * 0.9) / 3) + 1; i++) await S.call('progress', { lessonId: videoLesson.id, position: 1, delta: 3 });
  r = await S.call('quiz', { lessonId: videoLesson.id, answers: videoLesson.questions.map(() => 0) });
  check('영상 강의 퀴즈 응시', r.status === 200 && typeof r.json.score === 'number', `score=${r.json.score}`);
}
if (readingLesson) {
  const full = (await A.get()).json.questions.find((q) => q.id === readingLesson.id).questions;
  r = await S.call('quiz', { lessonId: readingLesson.id, answers: full.map((q) => q.answer) });
  check('읽기 강의(영상 없음) 퀴즈로 완료', r.status === 200 && r.json.passed === true, r.json.error);
  const p = (await S.get()).json.progress.find((x) => x.lesson_id === readingLesson.id);
  check('읽기 강의 complete=1', p?.complete === 1);
}
r = await S.call('bookmark', { lessonId: data.lessons[0].id });
check('책갈피 토글', r.status === 200);
r = await S.call('tnote', { lessonId: data.lessons[0].id, at: 3, body: '메모' });
check('타임스탬프 노트', r.status === 200);
r = await S.call('question', { lessonId: data.lessons[0].id, body: '질문입니다', isPublic: true });
check('질문 등록', r.status === 200);
r = await S.call('review', { courseId: data.lessons[0].course_id, rating: 5, body: '좋아요' });
check('후기 등록', r.status === 200);

// ── 라운지
r = await S.call('post', { category: '자유', title: '테스트 글', body: '내용' });
check('게시글 작성', r.status === 200 && r.json.id);
const postId = r.json.id;
r = await S.call('comment', { postId, body: '댓글' });
check('댓글 작성', r.status === 200);
r = await S.call('like', { id: postId });
check('좋아요', r.status === 200 && r.json.liked === true);
r = await S.get('?post=' + postId);
check('게시글 상세', r.status === 200 && r.json.comments?.length === 1);
r = await S.call('post', { category: '공지', title: 'x', body: 'y' });
check('교육생 공지 작성 차단', r.status === 403);

// ── 관리자 흐름
const admin = (await A.get()).json;
check('관리자 전용 데이터', Array.isArray(admin.users) && admin.quizStats !== undefined && admin.superAdmin === true);
const msg = admin.messages.find((m) => !m.reply);
if (msg) { r = await A.call('reply', { id: msg.id, reply: '답변' }); check('질문 답변', r.status === 200); }
r = await A.call('announcement', { title: '점검 공지', body: '본문', cohortId: '', pinned: 0, notify: true });
check('공지 등록', r.status === 200);
r = await A.call('event', { title: '점검 세션', starts: '2099-01-01T10:00', cohortId: '', capacity: 0, notify: false });
check('일정 등록', r.status === 200);
const evId = r.json.id;
r = await S.call('rsvp', { eventId: evId });
check('참석 신청', r.status === 200 && r.json.going === true);
r = await A.call('nudge', { ids: ['demo-student'], title: '점검 알림', body: '', link: '/learn' });
check('독려 알림', r.status === 200);
const notifs = (await S.get()).json.notifications;
check('교육생 알림 수신(답변·공지·독려)', notifs.some((n) => n.title.includes('답변')) && notifs.some((n) => n.title === '점검 공지') && notifs.some((n) => n.title === '점검 알림'));
r = await A.call('reorder', { table: 'courses', ids: admin.courses.map((c) => c.id) });
check('과정 순서 저장', r.status === 200);
r = await A.call('invite_bulk', { csv: `점검,smoke-${Date.now()}@test.com` });
check('CSV 일괄 등록', r.status === 200 && r.json.created === 1);
r = await A.get('?export=content');
check('콘텐츠 내보내기', r.status === 200 && Array.isArray(r.json.lessons));
r = await A.call('member', { id: 'demo-student', status: 'active' });
check('교육생 상태 변경', r.status === 200);

// ── 운영 관리자 경계
r = await A.call('invite', { name: '점검매니저', email: `mgr-${Date.now()}@test.com` });
const mgrId = r.json.userId;
await A.call('member', { id: mgrId, role: 'manager' });
const tok = (await A.call('reset_link', { userId: mgrId })).json.link.split('/reset/')[1];
const M = client('manager');
r = await M.call('reset', { token: tok, password: 'managerpass123' });
check('운영 관리자 비밀번호 설정 로그인', r.status === 200);
const mp = (await M.get()).json;
check('운영 관리자 응답에 재설정 토큰·비밀 설정 없음', (mp.resets ?? []).length === 0 && mp.adminSettings === undefined && mp.superAdmin === false);
r = await M.call('settings', { pass_score: '1' });
check('운영 관리자 연동 설정 403', r.status === 403);
const q2 = (await S.call('question', { body: '삭제 테스트', isPublic: true }));
const qid = (await A.get()).json.messages.find((m) => m.body === '삭제 테스트')?.id;
r = await M.call('question_delete', { id: qid });
check('운영 관리자 질문 삭제 실제 반영', r.status === 200 && !(await A.get()).json.messages.some((m) => m.id === qid));
await A.call('member_delete', { id: mgrId });
void q2;

// ── 체험 계정 토글
await A.call('settings', { demo_mode: '0' });
r = await client('x2').call('demo', { role: 'admin' });
check('체험 계정 끄면 demo 403', r.status === 403);
await A.call('settings', { demo_mode: '1' });

// ── 정리
await A.call('event_delete', { id: evId });
await S.call('post_delete', { id: postId });
await S.call('progress_reset', { courseId: data.lessons[0].course_id });
const afterReset = (await S.get()).json.progress.filter((p) => data.lessons.some((l) => l.id === p.lesson_id && l.course_id === data.lessons[0].course_id));
check('진도 초기화(시청·점수·응시 횟수 0)', afterReset.every((p) => p.watched === 0 && p.attempts === 0 && p.best_score === null));

// ── 레이트리밋 (같은 IP 의 다른 테스트에 영향을 주므로 SMOKE_RATELIMIT=1 일 때만)
if (process.env.SMOKE_RATELIMIT === '1') {
  let last = 0;
  const em = `rl-${Date.now()}@x.com`;
  for (let i = 0; i < 11; i++) last = (await X.call('login', { email: em, password: 'bad' })).status;
  check('같은 이메일 11회 실패 → 429', last === 429);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
