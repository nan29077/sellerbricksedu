#!/usr/bin/env node
/**
 * 셀러브릭스 캠퍼스 API 회귀 점검
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
const S = client('student'), A = client('admin'), D = client('demoAdmin'), X = client('anon');
import { createHmac } from 'node:crypto';
/** TOTP (RFC 6238) — 2단계 인증 점검용 */
function totp(secret, at = Date.now()) {
  const A32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0, value = 0; const bytes = [];
  for (const ch of secret) { value = (value << 5) | A32.indexOf(ch); bits += 5; if (bits >= 8) { bytes.push((value >>> (bits - 8)) & 255); bits -= 8; } }
  const buf = Buffer.alloc(8); buf.writeBigUInt64BE(BigInt(Math.floor(at / 30000)));
  const h = createHmac('sha1', Buffer.from(bytes)).update(buf).digest();
  const o = h[h.length - 1] & 15;
  return String((((h[o] & 127) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3]) % 1e6).padStart(6, '0');
}

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
r = await D.call('demo', { role: 'admin' });
check('관리자 체험 로그인', r.status === 200 && r.json.user?.role === 'admin');
// 실제 최고 관리자 확보: 없으면 가입 → 체험 관리자가 최초 1회 지정
const ADMIN = { email: 'smoke-admin@test.local', password: 'smokeadmin1234' };
r = await A.call('login', ADMIN);
if (r.status !== 200) {
  await client('reg0').call('register', { name: '점검관리자', email: ADMIN.email, password: ADMIN.password, agree: true });
  const target = (await D.get()).json.users.find((u) => u.name === '점검관리자');
  r = await D.call('bootstrap_admin', { id: target?.id });
  check('최초 최고 관리자 지정(체험 관리자, 관리자 없을 때만)', r.status === 200, r.json.error);
  r = await A.call('login', ADMIN);
}
check('실제 최고 관리자 로그인', r.status === 200 && r.json.user?.role === 'admin', r.json.error);
r = await D.call('bootstrap_admin', { id: 'x' });
check('관리자가 있으면 최초 지정 차단', r.status === 403);
// 체험 관리자: 둘러보기 전용
r = await D.call('reset_link', { userId: (await A.get()).json.user.id });
check('체험 관리자 재설정 링크 발급 차단(계정 탈취 방지)', r.status === 403);
r = await D.call('settings', { pass_score: '1' });
check('체험 관리자 연동 설정 차단', r.status === 403);
r = await D.call('announcement', { title: 'x', body: 'y' });
check('체험 관리자 운영 작업 차단', r.status === 403);
r = await D.get('?export=content');
check('체험 관리자 콘텐츠 내보내기 차단', r.status === 403);
{ const dp = (await D.get()).json; const real = dp.users.find((u) => u.name === '점검관리자');
  check('체험 관리자에게 실제 회원 이메일 가림', real && real.email.includes('***') && dp.adminSettings === undefined && (dp.resets ?? []).length === 0); }
// 변경 스탬프
{ const s1 = (await S.get('?stamp=1')).json.stamp; await A.call('faq', { question: '스탬프 점검', answer: '답', published: 0 });
  const s2 = (await S.get('?stamp=1')).json.stamp;
  check('변경 스탬프(가벼운 폴링) 증가', s1 && s2 && Number(s2) > Number(s1), `${s1}→${s2}`);
  const f = (await A.get()).json.faqs; void f; }
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
  const full = (await A.get()).json.questions.find((q) => q.id === videoLesson.id).questions;
  r = await S.call('quiz', { lessonId: videoLesson.id, answers: full.map((q) => (q.answer + 1) % q.options.length) });
  check('영상 강의 퀴즈 응시', r.status === 200 && typeof r.json.score === 'number', `score=${r.json.score}`);
  check('통과 전에는 정답·해설 비공개', r.json.passed === false && r.json.revealed === false && r.json.results.every((x) => x.answer === undefined && x.explanation === undefined));
  r = await S.call('quiz', { lessonId: videoLesson.id, answers: full.map((q) => q.answer) });
  check('통과하면 정답·해설 공개', r.json.passed === true && r.json.revealed === true && r.json.results.every((x) => x.answer !== undefined));
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
{ const mine = (await S.get()).json.messages.find((m) => m.body === '질문입니다' && !m.reply);
  r = await S.call('question_edit', { id: mine?.id, body: '질문입니다(수정)', isPublic: true });
  check('답변 전 질문 수정', r.status === 200);
  r = await S.call('question', { body: '일반 학습 문의', isPublic: false });
  check('강의 없는 일반 질문 등록', r.status === 200); }
r = await S.call('review', { courseId: data.lessons[0].course_id, rating: 5, body: '좋아요' });
check('후기 등록', r.status === 200);
r = await S.call('question', { lessonId: 'no-such-lesson', body: 'x' });
check('없는 강의에 질문 차단', r.status === 404);

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
if (msg) {
  r = await A.call('reply', { id: msg.id, reply: '' });
  const m0 = (await A.get()).json.messages.find((m) => m.id === msg.id);
  check('빈 답변은 답변 완료로 기록하지 않음', r.status === 200 && !m0.resolved && !m0.replied);
  r = await A.call('reply', { id: msg.id, reply: '답변' }); check('질문 답변', r.status === 200);
}
r = await A.call('announcement', { title: '점검 공지', body: '본문', cohortId: '', pinned: 0, notify: true });
check('공지 등록', r.status === 200);
r = await A.call('announcement', { title: '내부 공지', body: '본문', cohortId: '', pinned: 0, notify: false, public: 0 });
check('비공개 공지는 비로그인에 미노출', r.status === 200 && !(await X.get()).json.announcements.some((a) => a.title === '내부 공지') && (await S.get()).json.announcements.some((a) => a.title === '내부 공지'));
r = await A.call('event', { title: '점검 세션', starts: '2099-01-01T10:00', cohortId: '', capacity: 0, notify: false, link: 'https://meet.example.com/x' });
check('일정 등록', r.status === 200);
const evId = r.json.id;
check('참석 신청 전 세션 링크 비노출', (await S.get()).json.events.find((e) => e.id === evId)?.link !== 'https://meet.example.com/x');
r = await S.call('rsvp', { eventId: evId });
check('참석 신청', r.status === 200 && r.json.going === true);
check('참석 신청 후 세션 링크 노출', (await S.get()).json.events.find((e) => e.id === evId)?.link === 'https://meet.example.com/x');
{ // 자동 시작 알림: 40분 뒤 시작하는 일정 → 주기 작업 실행 시 참석자에게 1회만
  const kst = (ms) => new Date(ms + 9 * 3600000).toISOString().slice(0, 16);
  const soon = (await A.call('event', { title: '곧 시작 점검', starts: kst(Date.now() + 40 * 60000), notify: false })).json.id;
  await S.call('rsvp', { eventId: soon });
  r = await A.call('maintenance_run');
  const n1 = (await S.get()).json.notifications.filter((n) => n.title === '곧 시작: 곧 시작 점검').length;
  await A.call('maintenance_run');
  const n2 = (await S.get()).json.notifications.filter((n) => n.title === '곧 시작: 곧 시작 점검').length;
  check('일정 시작 전 자동 알림(1회만)', r.status === 200 && n1 === 1 && n2 === 1, `n1=${n1} n2=${n2}`);
  await A.call('event_delete', { id: soon });
}
r = await A.call('nudge', { ids: ['demo-student'], title: '점검 알림', body: '', link: '/learn' });
check('독려 알림', r.status === 200);
const notifs = (await S.get()).json.notifications;
check('교육생 알림 수신(답변·공지·독려)', notifs.some((n) => n.title.includes('답변')) && notifs.some((n) => n.title === '점검 공지') && notifs.some((n) => n.title === '점검 알림'));
{ const sp = (await S.get()).json; const ann = sp.announcements.find((a) => a.title === '점검 공지');
  check('새 공지는 안 읽음 상태', ann && !ann.read);
  r = await S.call('notice_read', { id: ann?.id });
  check('공지 읽음 처리', r.status === 200 && (await S.get()).json.announcements.find((a) => a.id === ann?.id)?.read === 1);
  r = await S.call('notice_read', { all: true });
  check('공지 모두 읽음', r.status === 200);
  check('관리자 공지 읽음 수 집계', ((await A.get()).json.announcements.find((a) => a.id === ann?.id)?.reads || 0) >= 1);
  r = await S.call('notif_read', { all: true }); r = await S.call('notif_clear');
  check('읽은 알림 지우기', r.status === 200 && (await S.get()).json.notifications.length === 0); }
r = await A.call('event', { id: evId, title: '점검 세션', starts: '2099-01-01T10:00', cohortId: '', capacity: 0, replay: 'https://example.com/replay' });
check('다시보기 링크 등록 + 참석자 알림', r.status === 200 && (await S.get()).json.notifications.some((n) => n.title.startsWith('다시보기 등록')));
r = await A.call('event', { id: evId, title: '점검 세션', starts: '2099-01-01T10:00', replay: 'javascript:alert(1)' });
check('다시보기 링크 https 검증', r.status === 400);
if (admin.assignments?.length) { r = await A.call('assignment_remind', { id: admin.assignments[0].id }); check('과제 미제출 리마인드', r.status === 200 && typeof r.json.count === 'number'); }
r = await S.call('assignment_remind', { id: 'x' });
check('교육생 과제 리마인드 차단', r.status === 403);
r = await A.call('reorder', { table: 'courses', ids: admin.courses.map((c) => c.id) });
check('과정 순서 저장', r.status === 200);
r = await A.call('invite_bulk', { csv: `점검,smoke-${Date.now()}@test.com` });
check('CSV 일괄 등록', r.status === 200 && r.json.created === 1);
r = await A.get('?export=content');
check('콘텐츠 내보내기', r.status === 200 && Array.isArray(r.json.lessons));
r = await A.call('member', { id: 'demo-student', status: 'active' });
check('교육생 상태 변경', r.status === 200);

// ── 운영 관리자 경계
const mgrEmail = `mgr-${Date.now()}@test.com`;
r = await A.call('invite', { name: '점검매니저', email: mgrEmail });
const mgrId = r.json.userId;
await A.call('member', { id: mgrId, role: 'manager' });
check('초대 시 비밀번호 설정 링크 반환', typeof r.json.link === 'string' && r.json.link.includes('/reset/'));
const tok = r.json.link.split('/reset/')[1];
const M = client('manager');
r = await M.call('reset', { token: tok, password: 'managerpass123' });
check('운영 관리자 비밀번호 설정 로그인', r.status === 200);
{ // 운영진 2단계 인증
  const setup = (await M.call('mfa_setup')).json;
  r = await M.call('mfa_enable', { code: '000000' });
  check('2단계 인증: 잘못된 코드 거부', r.status === 400);
  r = await M.call('mfa_enable', { code: totp(setup.secret) });
  check('2단계 인증 켜기', r.status === 200, r.json.error);
  const M2 = client('manager2');
  r = await M2.call('login', { email: mgrEmail, password: 'managerpass123' });
  check('2단계 인증 계정 로그인 → 코드 요구', r.status === 200 && !!r.json.mfa && !r.json.user);
  const t2 = r.json.mfa;
  r = await M2.call('login_mfa', { token: t2, code: '123456' });
  check('2단계 인증 코드 오류 401', r.status === 401);
  r = await M2.call('login_mfa', { token: t2, code: totp(setup.secret) });
  check('2단계 인증 코드 확인 후 로그인', r.status === 200 && r.json.user?.role === 'manager', r.json.error);
  r = await A.call('mfa_reset', { userId: mgrId });
  check('최고 관리자 2단계 인증 초기화', r.status === 200);
  r = await M.call('login', { email: mgrEmail, password: 'managerpass123' });
  check('초기화 후 비밀번호만으로 로그인', r.status === 200 && r.json.user);
}
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

// ── 약관 동의·회원 탈퇴
r = await client('reg').call('register', { name: '동의없음', email: `noagree-${Date.now()}@test.com`, password: 'password1234' });
check('약관 미동의 가입 차단 400', r.status === 400);
r = await client('reg2').call('register', { name: '동의함', email: `agree-${Date.now()}@test.com`, password: 'password1234', agree: true });
check('약관 동의 가입 신청', r.status === 200);
{
  const em = `wd-${Date.now()}@test.com`;
  const wid = (await A.call('invite', { name: '탈퇴테스트', email: em })).json.userId;
  const wtok = (await A.call('reset_link', { userId: wid })).json.link.split('/reset/')[1];
  const W = client('withdraw');
  await W.call('reset', { token: wtok, password: 'withdrawpass123' });
  await W.call('post', { category: '자유', title: '탈퇴 전 글', body: '내용' });
  r = await W.call('withdraw', { password: 'wrongpass000' });
  check('탈퇴: 비밀번호 틀리면 400', r.status === 400);
  r = await W.call('withdraw', { password: 'withdrawpass123' });
  check('탈퇴 완료', r.status === 200);
  const after = (await A.get()).json;
  check('탈퇴 후 계정·게시물 삭제', !after.users.some((u) => u.id === wid) && !after.posts.some((p) => p.user_id === wid));
  r = await W.call('progress', { lessonId: 'start-1' });
  check('탈퇴 후 세션 무효(401)', r.status === 401);
}
r = await S.call('withdraw', { confirm: '탈퇴' });
check('체험 계정 탈퇴 차단', r.status === 400);

// ── 초대 링크로 비밀번호 설정 후 변경
{
  const em = `nopw-${Date.now()}@test.com`;
  const inv = (await A.call('invite', { name: '비번없음', email: em })).json;
  const N = client('nopw');
  r = await N.call('reset', { token: inv.link.split('/reset/')[1], password: 'firstpass1234' });
  check('초대 링크로 비밀번호 설정·로그인', r.status === 200 && (await N.get()).json.user?.email === em);
  r = await N.call('password', { newPassword: 'secondpass1234', confirmPassword: 'secondpass1234', currentPassword: 'wrongpass1234' });
  check('비밀번호 변경: 현재 비밀번호 확인', r.status === 400);
  r = await N.call('password', { newPassword: 'secondpass1234', confirmPassword: 'secondpass1234', currentPassword: 'firstpass1234' });
  check('비밀번호 변경', r.status === 200, r.json.error);
  await A.call('member_delete', { id: inv.userId });
}

// ── 과제 재제출·순차 학습·수료
{
  let ap = (await A.get()).json;
  if (!ap.assignments.some((a) => a.published)) { await A.call('assignment', { courseId: data.lessons[0].course_id, title: '점검 과제', description: '설명', published: 1, position: 1 }); ap = (await A.get()).json; }
  const asg = ap.assignments.find((a) => a.published);
  r = await A.call('assignment_remind', { id: asg.id });
  check('과제 리마인드: 과정 시작한 미제출자만', r.status === 200 && typeof r.json.count === 'number');
  if (asg) {
    await S.call('submit', { assignmentId: asg.id, body: '첫 제출' });
    const sub = (await A.get()).json.submissions.find((s) => s.assignment_id === asg.id && s.user_id === 'demo-student');
    await A.call('review_submission', { id: sub.id, status: 'passed', score: 90, feedback: '좋아요' });
    r = await S.call('submit', { assignmentId: asg.id, body: '덮어쓰기' });
    const after = (await A.get()).json.submissions.find((s) => s.id === sub.id);
    check('통과한 과제 재제출 차단(점수·피드백 보존)', r.status === 400 && after.status === 'passed' && after.score === 90 && after.feedback === '좋아요');
    await A.call('review_submission', { id: sub.id, status: 'revise', feedback: '보완' });
    r = await S.call('submit', { assignmentId: asg.id, body: '보완 제출' });
    check('보완 요청 과제는 재제출 가능', r.status === 200);
  }
  // 순차 학습: 앞 강의를 끝내지 않으면 다음 강의 확인 문제 차단
  const c = ap.courses.find((x) => ap.lessons.filter((l) => l.course_id === x.id).length >= 3 && !ap.lessons.some((l) => l.course_id === x.id && l.video));
  if (c) {
    const ls = ap.lessons.filter((l) => l.course_id === c.id).sort((a, b) => a.position - b.position);
    await S.call('progress_reset', { courseId: c.id });
    await A.call('course', { ...c, sequential: 1 });
    const qs = (id) => ap.questions.find((q) => q.id === id).questions.map((q) => q.answer);
    r = await S.call('quiz', { lessonId: ls[1].id, answers: qs(ls[1].id) });
    check('순차 학습: 이전 강의 미완료 시 차단', r.status === 403);
    await A.call('course', { ...c, sequential: 0 });
    // 수료: 모든 강의 통과 → 수료증 1건, 다시 통과해도 중복 발급 없음
    for (const l of ls) await S.call('quiz', { lessonId: l.id, answers: qs(l.id) });
    await S.call('quiz', { lessonId: ls[0].id, answers: qs(ls[0].id) });
    const certs = (await S.get()).json.certificates.filter((x) => x.course_id === c.id);
    check('과정 수료증 발급(중복 없음)', certs.length === 1 && /^SB-[A-Z0-9]{10}$/.test(certs[0].id), certs.map((x) => x.id).join(','));
    r = await X.get('?verify=' + certs[0]?.id);
    check('수료증 공개 검증', r.status === 200 && r.json.ok);
    await S.call('progress_reset', { courseId: c.id });
    const days = (await S.get()).json.learningDays.reduce((s, d) => s + d.completed, 0);
    for (const l of ls) await S.call('quiz', { lessonId: l.id, answers: qs(l.id) });
    const days2 = (await S.get()).json.learningDays.reduce((s, d) => s + d.completed, 0);
    check('재수강 완료는 학습 통계에 중복 집계 안 함', days2 === days, `${days}→${days2}`);
  }
}

// ── 영상 업로드·복제 공유 파일 보호 (R2)
{
  const fs = await import('node:fs');
  const mp4 = fs.readFileSync(new URL('../public/sample-intro.mp4', import.meta.url));
  const up = async (lessonId, body = mp4, type = 'video/mp4', kind = 'video', name = 'a.mp4') => {
    const res = await fetch(`${BASE}/api/upload?lessonId=${encodeURIComponent(lessonId)}&kind=${kind}&name=${name}`, { method: 'POST', headers: { 'Content-Type': type, cookie: jar.admin }, body });
    return { status: res.status, json: await res.json().catch(() => ({})) };
  };
  const c = (await A.call('course', { title: '업로드 점검 과정', description: '', category: '입문', position: 99, published: 0 })).json.id;
  const l = (await A.call('lesson', { course_id: c, title: '업로드 강의', duration: 60, questions: JSON.stringify([{ question: 'q', options: ['a', 'b'], answer: 0 }]) })).json.id;
  r = await up(l);
  check('영상 스트리밍 업로드', r.status === 200 && r.json.video?.startsWith('/api/media/'), r.json.error);
  const v1 = r.json.video;
  r = await up(l, Buffer.from('x'), 'text/html');
  check('허용되지 않은 형식 업로드 거부', r.status === 400);
  r = await fetch(`${BASE}/api/upload?lessonId=${l}&kind=video&name=a.mp4`, { method: 'POST', headers: { 'Content-Type': 'video/mp4', cookie: jar.student }, body: mp4 });
  check('교육생 업로드 차단', r.status === 403);
  const dup = (await A.call("course_duplicate", { id: c })).json.id;
  const dl = (await A.get()).json.lessons.find((x) => x.course_id === dup);
  r = await up(dl.id);
  const orig = await fetch(BASE + v1, { headers: { cookie: jar.admin, Range: 'bytes=0-99' } });
  check('복제본에 새 영상 업로드해도 원본 영상 유지', r.status === 200 && orig.status === 206, `orig=${orig.status}`);
  r = await up(l, Buffer.from('WEBVTT\n\n00:00.000 --> 00:02.000\n안녕하세요\n'), 'text/vtt', 'captions', 'ko.vtt');
  check('자막(VTT) 업로드', r.status === 200 && r.json.captions?.startsWith('/api/media/'), r.json.error);
  await A.call('course_delete', { id: dup });
  const still = await fetch(BASE + v1, { headers: { cookie: jar.admin, Range: 'bytes=0-99' } });
  check('복제본 삭제 후에도 원본 영상 유지', still.status === 206);
  await A.call('course_delete', { id: c });
  const gone = await fetch(BASE + v1, { headers: { cookie: jar.admin } });
  check('마지막 참조 강의 삭제 시 영상 정리', gone.status === 404);
  r = await A.call('lesson', { course_id: 'start', title: 'x', video: 'javascript:alert(1)', questions: '[{"question":"q","options":["a","b"],"answer":0}]' });
  check('강의 영상 주소 검증', r.status === 400);
  r = await A.call('lessons_import', { course_id: 'start', items: JSON.stringify([{ title: 'x', questions: [{ question: 'q', options: ['a'], answer: 3 }] }]) });
  check('강의 일괄 등록: 잘못된 확인 문제 거부', r.status === 400);
}

// ── 빈도 제한·로그인 IP 카운터
{
  const B = client('spam');
  await A.call('settings', { auto_approve: '1' });
  const em = `spam-${Date.now()}@test.com`;
  await B.call('register', { name: '도배', email: em, password: 'spampass1234', agree: true });
  await B.call('login', { email: em, password: 'spampass1234' });
  let last = 0;
  for (let i = 0; i < 11; i++) last = (await B.call('post', { category: '자유', title: 't' + i, body: 'b' })).status;
  check('게시글 도배 제한(15분 10건) → 429', last === 429);
  await A.call('settings', { auto_approve: '0' });
  const sp = (await A.get()).json.users.find((u) => u.email === em);
  if (sp) await A.call('member_delete', { id: sp.id });
}

// ── 설정 검증·배너
r = await A.call('settings', { banner_on: '1', banner_text: '점검 배너', banner_link: 'javascript:alert(1)' });
check('배너 링크 검증(javascript: 차단)', r.status === 400);
check('검증 실패 시 다른 값도 저장 안 됨', (await X.get()).json.settings.banner_text !== '점검 배너');
r = await A.call('settings', { banner_on: '1', banner_text: '점검 배너', banner_link: '/courses', banner_tone: 'good' });
const pub = (await X.get()).json.settings;
check('배너 공개 설정 반영', r.status === 200 && pub.banner_on === '1' && pub.banner_text === '점검 배너' && pub.banner_tone === 'good');
await A.call('settings', { banner_on: '0', banner_text: '' });

// ── SEO·보안 헤더
r = await fetch(BASE + '/robots.txt');
check('robots.txt', r.status === 200 && (await r.text()).includes('Disallow: /admin'));
r = await fetch(BASE + '/sitemap.xml');
{ const t = await r.text(); check('sitemap.xml (공개 과정 포함)', r.status === 200 && t.includes('<urlset') && t.includes('/course/')); }
r = await fetch(BASE + '/');
check('보안 헤더(nosniff·X-Frame-Options)', r.headers.get('x-content-type-options') === 'nosniff' && r.headers.get('x-frame-options') === 'SAMEORIGIN');

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
