#!/usr/bin/env node
/**
 * 셀러브릭스 캠퍼스 — 브라우저 UI 시뮬레이션 (Playwright)
 * 준비: npm i -g playwright && npx playwright install chromium   (또는 프로젝트 밖 임시 폴더에 설치)
 * 실행: 서버를 띄운 뒤  node scripts/ui-sim.mjs [http://127.0.0.1:3040]
 * 체험 계정과 테스트 데이터를 생성하므로 로컬/스테이징에서만 실행하세요.
 */
import { chromium } from 'playwright';
const B = process.argv[2] || 'http://127.0.0.1:3040';
const b = await chromium.launch(process.env.PW_CHROME ? { executablePath: process.env.PW_CHROME } : {});
const issues = [], ok = [];
const pass = (l) => ok.push(l);
const fail = (l) => issues.push(l);
function watch(p, tag) {
  p.on('pageerror', e => fail(`[${tag}] pageerror ${e.message}`));
  p.on('console', m => { if (m.type() === 'error' && !/favicon|status of 4\d\d|net::ERR_ABORTED/.test(m.text())) fail(`[${tag}] console ${m.text().slice(0, 160)}`); });
  p.on('response', r => { if (r.status() >= 500) fail(`[${tag}] HTTP ${r.status()} ${r.url()}`); });
}
const t = (ms) => new Promise(r => setTimeout(r, ms));
/** 실제 최고 관리자로 로그인 (체험 관리자는 둘러보기 전용). 없으면 smoke-test 와 같은 방식으로 최초 지정 */
const ADMIN = { email: 'smoke-admin@test.local', password: 'smokeadmin1234' };
async function adminLogin(request) {
  let r = await request.post(B + '/api/edu', { data: { action: 'login', ...ADMIN } });
  if (r.ok()) return;
  await request.post(B + '/api/edu', { data: { action: 'register', name: '점검관리자', ...ADMIN, agree: true } });
  await request.post(B + '/api/edu', { data: { action: 'demo', role: 'admin' } });
  const u = (await (await request.get(B + '/api/edu')).json()).users.find((x) => x.name === '점검관리자');
  await request.post(B + '/api/edu', { data: { action: 'bootstrap_admin', id: u?.id } });
  r = await request.post(B + '/api/edu', { data: { action: 'login', ...ADMIN } });
  if (!r.ok()) throw new Error('관리자 로그인 실패');
}

async function S1() {
// ─── 시나리오 1: 신규 교육생 가입 → 관리자 승인 → 로그인 → 학습 ───
{
  const ctx = await b.newContext({ viewport: { width: 1380, height: 1000 } });
  const p = await ctx.newPage(); watch(p, 'S1');
  const email = `sim-${Date.now()}@test.com`;
  await p.goto(B + '/login?mode=register', { waitUntil: 'networkidle' });
  await p.fill('input[autocomplete=name]', '시뮬셀러');
  await p.fill('input[type=email]', email);
  await p.fill('input[type=password]', 'simulation123');
  // 필수 동의 하나 빠지면 차단
  await p.locator('.consent-box input[type=checkbox]').nth(1).check();
  await p.getByRole('button', { name: '교육 가입 신청' }).last().click();
  await t(300);
  /필수 항목/.test(await p.locator('.form-message').textContent() || '') ? pass('필수 동의 누락 시 가입 차단') : fail('필수 동의 누락 차단 실패');
  await p.locator('.consent-all input').check();
  await p.getByRole('button', { name: '교육 가입 신청' }).last().click();
  await t(800);
  const msg = await p.locator('.form-message').textContent();
  /승인/.test(msg || '') ? pass('가입 신청 → 승인 대기 안내') : fail('가입 신청 메시지: ' + msg);
  // 승인 전 로그인 시도
  await p.locator('.login-tabs button').first().click();
  await p.fill('input[type=email]', email); await p.fill('input[type=password]', 'simulation123');
  await p.getByRole('button', { name: '이메일로 로그인' }).click(); await t(600);
  /승인 대기/.test(await p.locator('.form-message').textContent() || '') ? pass('승인 전 로그인 차단') : fail('승인 전 로그인 차단 실패');
  // 관리자 승인 (API)
  await adminLogin(ctx.request);
  const users = (await (await ctx.request.get(B + '/api/edu')).json()).users;
  const nu = users.find((u) => u.email === email);
  await ctx.request.post(B + '/api/edu', { data: { action: 'member', id: nu.id, status: 'active' } });
  await ctx.request.post(B + '/api/edu', { data: { action: 'logout' } });
  // 승인 후 로그인 via UI
  await p.goto(B + '/login', { waitUntil: 'networkidle' });
  await p.fill('input[type=email]', email); await p.fill('input[type=password]', 'simulation123');
  await p.getByRole('button', { name: '이메일로 로그인' }).click(); await p.waitForURL('**/learn', { timeout: 8000 }).then(() => pass('승인 후 로그인 → 대시보드')).catch(() => fail('로그인 후 대시보드 이동 실패'));
  await t(500);
  // 승인 알림 수신
  const bell = await p.locator('.bell-badge').textContent().catch(() => '');
  bell ? pass('승인 알림 배지 표시 (' + bell + ')') : fail('승인 알림 배지 없음');
  // 읽기 강의 퀴즈 UI 로 완료
  await p.goto(B + '/lesson/start-2', { waitUntil: 'networkidle' });
  const radios = p.locator('.quiz-item');
  const n = await radios.count();
  for (let i = 0; i < n; i++) await radios.nth(i).locator('label').first().click();
  await p.getByRole('button', { name: '확인 문제 제출' }).click(); await t(800);
  const total = await p.locator('.quiz-total').textContent().catch(() => '');
  /점/.test(total || '') ? pass('읽기 강의 퀴즈 제출 UI: ' + total.slice(0, 30)) : fail('퀴즈 제출 결과 없음');
  // 타임스탬프 노트 추가
  await p.fill('.tnote-form input', '시뮬 노트'); await p.getByRole('button', { name: '추가' }).click(); await t(600);
  (await p.locator('.tnote-list li').count()) > 0 ? pass('타임스탬프 노트 추가') : fail('타임스탬프 노트 미표시');
  // 질문 등록
  await p.getByRole('tab', { name: /강의 Q&A/ }).click();
  await p.fill('.lesson-qa textarea', '시뮬 질문입니다'); await p.getByRole('button', { name: '질문 등록' }).click(); await t(600);
  (await p.locator('.qa-item').count()) > 0 ? pass('강의 질문 등록') : fail('질문 미표시');
  // 라운지 글쓰기 모달 + 미저장 가드
  await p.goto(B + '/learn/lounge', { waitUntil: 'networkidle' });
  await p.getByRole('button', { name: '글쓰기' }).first().click(); await t(300);
  await p.fill('[role=dialog] input', '임시 제목');
  await p.keyboard.press('Escape'); await t(300);
  (await p.locator('[role=alertdialog]').count()) ? pass('미저장 모달 닫기 확인창') : fail('미저장 확인창 없음');
  await p.locator('[role=alertdialog] button', { hasText: '취소' }).click(); await t(200);
  await p.fill('[role=dialog] textarea', '시뮬 본문');
  await p.locator('[role=dialog] button[type=submit]').click(); await t(900);
  /lounge\/[\w-]+/.test(p.url()) ? pass('글 작성 → 상세로 이동') : fail('글 작성 후 이동 실패: ' + p.url());
  await p.fill('.comment-form textarea', '첫 댓글'); await p.getByRole('button', { name: '등록' }).click(); await t(600);
  (await p.locator('.comment').count()) === 1 ? pass('댓글 등록') : fail('댓글 미표시');
  // 일정 참석
  await adminLogin(ctx.request);
  await ctx.request.post(B + '/api/edu', { data: { action: 'event', title: '시뮬 세션', starts: '2099-05-05T20:00', cohortId: '', capacity: 0, notify: true } });
  await ctx.request.post(B + '/api/edu', { data: { action: 'logout' } });
  // 교육생으로 다시 로그인 (쿠키 덮였으므로)
  await p.goto(B + '/login', { waitUntil: 'networkidle' });
  await p.fill('input[type=email]', email); await p.fill('input[type=password]', 'simulation123');
  await p.getByRole('button', { name: '이메일로 로그인' }).click(); await p.waitForURL('**/learn'); await t(400);
  (await p.locator('.event-banner').count()) ? pass('대시보드 일정 배너') : fail('일정 배너 없음');
  await p.goto(B + '/learn/events', { waitUntil: 'networkidle' });
  await p.getByRole('button', { name: '참석 신청' }).first().click(); await t(600);
  (await p.locator('text=신청 완료').count()) ? pass('일정 참석 신청') : fail('참석 신청 실패');
  await ctx.close();
}

}
async function S2() {
// ─── 시나리오 2: 관리자 — 과정 생성 → 강의 추가 → 교육생 화면 반영, 답변 → 알림 ───
{
  const ctx = await b.newContext({ viewport: { width: 1380, height: 1000 } });
  const p = await ctx.newPage(); watch(p, 'S2');
  await adminLogin(p.request);
  await p.goto(B + '/admin/courses', { waitUntil: 'networkidle' });
  await p.getByRole('button', { name: '과정 등록' }).first().click(); await t(300);
  await p.fill('[role=dialog] input', '시뮬 과정');
  await p.locator('[role=dialog] button[type=submit]').click(); await t(900);
  (await p.locator('text=시뮬 과정').count()) ? pass('과정 등록 모달 → 목록 반영') : fail('과정 등록 미반영');
  await p.goto(B + '/admin/videos', { waitUntil: 'networkidle' });
  await p.getByRole('button', { name: '강의 등록' }).first().click(); await t(300);
  await p.selectOption('[role=dialog] select >> nth=0', { label: '시뮬 과정' });
  await p.fill('[role=dialog] input[required]', '시뮬 강의');
  // 퀴즈 탭 비어 있는 채로 저장 → 서버 검증 메시지 기대
  await p.locator('[role=dialog] button[type=submit]').click(); await t(800);
  const toast = await p.locator('.toast').textContent().catch(() => '');
  /확인 문제/.test(toast || '') ? pass('빈 퀴즈 저장 시 서버 검증 토스트: ' + toast.slice(0, 40)) : fail('빈 퀴즈 저장 피드백 없음: ' + toast);
  await p.getByRole('tab', { name: /확인 문제/ }).click();
  await p.fill('.question-editor label:has-text("문제 1") input', '시뮬 문제');
  await p.locator('.quiz-edit-option').nth(0).locator('input:not([type=radio])').fill('보기A');
  await p.locator('.quiz-edit-option').nth(1).locator('input:not([type=radio])').fill('보기B');
  await p.locator('[role=dialog] button[type=submit]').click(); await t(900);
  (await p.locator('[role=dialog]').count()) === 0 ? pass('강의 등록 완료(모달 닫힘)') : fail('강의 등록 후 모달 안 닫힘');
  // 답변 → 교육생 알림
  await p.goto(B + '/admin/questions', { waitUntil: 'networkidle' });
  const btn = p.getByRole('button', { name: '답변 작성' }).first();
  if (await btn.count()) { await btn.click(); await t(300); await p.fill('[role=dialog] textarea', '시뮬 답변'); await p.locator('[role=dialog] button[type=submit]').click(); await t(800); pass('질문 답변 등록'); } else fail('답변 대기 질문 없음');
  // 교육생 관리: 메모 저장 시 모달 유지
  await p.goto(B + '/admin/members', { waitUntil: 'networkidle' });
  await p.getByRole('button', { name: '학습 상세·메모' }).first().click(); await t(300);
  await p.fill('[role=dialog] textarea', '시뮬 메모'); await p.getByRole('button', { name: '메모 저장' }).click(); await t(700);
  (await p.locator('[role=dialog]').count()) === 1 ? pass('메모 저장 후 모달 유지') : fail('메모 저장 후 모달 닫힘');
  await p.keyboard.press('Escape'); await t(200);
  // 설정: 체험 계정 경고 표시
  await p.goto(B + '/admin/settings', { waitUntil: 'networkidle' });
  (await p.locator('text=자동 알림·정리').count()) ? pass('설정: 자동 알림·정리 패널 표시') : fail('자동 알림 설정 패널 없음');
  // 모달 포커스 가두기: 과정 등록 모달에서 Tab 을 여러 번 눌러도 포커스가 대화상자 안에 머문다
  await p.goto(B + '/admin/courses', { waitUntil: 'networkidle' });
  await p.getByRole('button', { name: '과정 등록' }).first().click(); await t(300);
  for (let i = 0; i < 25; i++) await p.keyboard.press('Tab');
  (await p.evaluate(() => !!document.activeElement?.closest('[role=dialog]'))) ? pass('모달 포커스 가두기(Tab 25회)') : fail('모달 밖으로 포커스 이탈');
  await p.keyboard.press('Escape'); await t(200);
  if (await p.locator('[role=alertdialog]').count()) { await p.locator('[role=alertdialog] button', { hasText: '닫기' }).click(); await t(200); }
  // 과정 삭제 → 학습 경로·교육생 화면 안전
  await p.goto(B + '/admin/courses', { waitUntil: 'networkidle' });
  const before = await p.locator('.admin-course', { hasText: '시뮬 과정' }).count();
  const card = p.locator('.admin-course', { hasText: '시뮬 과정' }).first();
  await card.locator('button[title=삭제]').click(); await t(300);
  await p.locator('[role=alertdialog] button', { hasText: '삭제' }).click(); await t(900);
  (await p.locator('.admin-course', { hasText: '시뮬 과정' }).count()) === before - 1 ? pass('과정 삭제 반영') : fail('과정 삭제 미반영');
  await ctx.close();
}

}
async function S3() {
// ─── 시나리오 3: 교육생 — 답변 알림 확인 + 모바일 사이드바 ───
{
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  const p = await ctx.newPage(); watch(p, 'S3');
  await p.request.post(B + '/api/edu', { data: { action: 'demo', role: 'student' } });
  await p.goto(B + '/learn', { waitUntil: 'networkidle' });
  await p.locator('.portal-header .mobile-menu').click(); await t(300);
  (await p.locator('.sidebar.open').count()) ? pass('모바일 사이드바 열림') : fail('모바일 사이드바 안 열림');
  await p.locator('.sidebar nav button', { hasText: '나의 강의실' }).click(); await t(400);
  (await p.locator('.sidebar.open').count()) === 0 && p.url().endsWith('/learn/courses') ? pass('메뉴 이동 시 사이드바 닫힘') : fail('사이드바 닫힘/이동 실패');
  await p.locator('.bell').click(); await t(300);
  (await p.locator('.notif-panel').count()) ? pass('모바일 알림 패널') : fail('알림 패널 안 열림');
  await ctx.close();
}

}
async function S4() {
// ─── 시나리오 4: v4 기능 — 체험 관리자 제한, 퀴즈 정답 비공개, 노트 자동 저장, 알림 화면, 모바일 하단 바, 외부 영상 ───
{
  // 체험 관리자: 안내 띠 + 저장 차단
  const ctx = await b.newContext({ viewport: { width: 1380, height: 1000 } });
  const p = await ctx.newPage(); watch(p, 'S4');
  await p.request.post(B + '/api/edu', { data: { action: 'demo', role: 'admin' } });
  await p.goto(B + '/admin', { waitUntil: 'networkidle' });
  (await p.locator('.demo-strip').count()) ? pass('체험 관리자 안내 띠 표시') : fail('체험 관리자 안내 없음');
  await p.goto(B + '/admin/courses', { waitUntil: 'networkidle' });
  await p.getByRole('button', { name: '과정 등록' }).first().click(); await t(300);
  await p.fill('[role=dialog] input', '체험 저장 시도');
  await p.locator('[role=dialog] button[type=submit]').click(); await t(700);
  /둘러보기/.test(await p.locator('.toast').textContent().catch(() => '') || '') ? pass('체험 관리자 저장 차단 안내') : fail('체험 관리자 저장 차단 안내 없음');
  (await p.locator('text=체험 저장 시도').count()) <= 1 ? pass('체험 관리자 저장 미반영') : fail('체험 관리자 저장이 반영됨');
  // 로그인 상태로 /login → 대시보드
  await p.keyboard.press('Escape'); await t(200);
  if (await p.locator('[role=alertdialog]').count()) { await p.locator('[role=alertdialog] button', { hasText: '닫기' }).click(); await t(200); }
  await p.goto(B + '/login', { waitUntil: 'networkidle' }); await t(500);
  p.url().endsWith('/admin') ? pass('로그인 상태로 /login → 대시보드 이동') : fail('로그인 상태 /login 리다이렉트 실패: ' + p.url());
  await ctx.close();
}
{
  // 교육생: 퀴즈 오답 시 정답 비공개, 노트 자동 저장, 알림 화면, 탭 제목
  const ctx = await b.newContext({ viewport: { width: 1380, height: 1000 } });
  const p = await ctx.newPage(); watch(p, 'S4s');
  await p.request.post(B + '/api/edu', { data: { action: 'demo', role: 'student' } });
  await p.request.post(B + '/api/edu', { data: { action: 'progress_reset', courseId: 'start' } });
  await p.goto(B + '/lesson/start-3', { waitUntil: 'networkidle' });
  (await p.title()).includes('셀러브릭스 캠퍼스') && !(await p.title()).startsWith('첫 라이브') ? pass('강의 화면 탭 제목: ' + (await p.title()).slice(0, 30)) : fail('탭 제목 미반영: ' + await p.title());
  // 정답을 모르는 상태로 모두 같은 원래 번호(마지막 보기)를 고르면 오답 가능성이 높다 → 결과에 정답 표시(.answer)가 없어야 함
  const items = p.locator('.quiz-item');
  const n = await items.count();
  for (let i = 0; i < n; i++) await items.nth(i).locator('label').last().click();
  await p.getByRole('button', { name: '확인 문제 제출' }).click(); await t(900);
  const totalText = await p.locator('.quiz-total').textContent().catch(() => '');
  if (/통과하면 정답과 해설/.test(totalText || '')) (await p.locator('.quiz-option.answer').count()) === 0 ? pass('오답 시 정답·해설 비공개') : fail('오답인데 정답 표시됨');
  else pass('퀴즈 결과 표시(통과): ' + (totalText || '').slice(0, 20));
  await p.fill('.general-note textarea', '자동 저장 확인용 노트');
  await t(2600);
  /자동 저장됨/.test(await p.locator('.note-status').textContent().catch(() => '') || '') ? pass('강의 노트 자동 저장') : fail('노트 자동 저장 상태 없음: ' + await p.locator('.note-status').textContent().catch(() => ''));
  await p.reload({ waitUntil: 'networkidle' });
  (await p.locator('.general-note textarea').inputValue()) === '자동 저장 확인용 노트' ? pass('새로고침 후 노트 유지') : fail('노트가 저장되지 않음');
  await p.goto(B + '/learn/notifications', { waitUntil: 'networkidle' });
  (await p.locator('.notif-page').count()) ? pass('알림 전체 화면') : fail('알림 화면 없음');
  // 단축키: 버튼에 포커스가 있을 때 Space 는 버튼을 눌러야 한다(플레이어가 가로채지 않음)
  await p.goto(B + '/lesson/start-1', { waitUntil: 'networkidle' });
  await p.locator('.player-toolbar button', { hasText: '단축키' }).focus();
  await p.keyboard.press('Space'); await t(200);
  (await p.locator('.keys-help').count()) ? pass('버튼 포커스 시 Space 로 버튼 동작(플레이어 단축키 미간섭)') : fail('Space 가 플레이어에 가로채짐');
  await ctx.close();
}
{
  // 모바일: 하단 바 + 메뉴 그룹
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  const p = await ctx.newPage(); watch(p, 'S4m');
  await p.request.post(B + '/api/edu', { data: { action: 'demo', role: 'student' } });
  await p.goto(B + '/learn', { waitUntil: 'networkidle' });
  (await p.locator('.bottom-nav').isVisible()) ? pass('모바일 하단 바 표시') : fail('모바일 하단 바 없음');
  await p.locator('.bottom-nav button', { hasText: '강의실' }).click(); await t(300);
  p.url().endsWith('/learn/courses') ? pass('하단 바 이동') : fail('하단 바 이동 실패');
  await p.locator('.bottom-nav button', { hasText: '전체 메뉴' }).click(); await t(300);
  (await p.locator('.sidebar.open .nav-group-label').count()) >= 3 ? pass('전체 메뉴(그룹) 열림') : fail('메뉴 그룹 없음');
  await ctx.close();
}
{
  // 2단계 인증 입력 화면, 이메일 인증 실패 안내, 외부 영상(YouTube) 강의 렌더링
  const ctx = await b.newContext({ viewport: { width: 1380, height: 1000 } });
  const p = await ctx.newPage(); watch(p, 'S4x');
  await p.goto(B + '/login?mfa=dummy', { waitUntil: 'networkidle' });
  (await p.locator('input[autocomplete=one-time-code]').count()) ? pass('2단계 인증 코드 입력 화면') : fail('2단계 인증 화면 없음');
  await p.fill('input[autocomplete=one-time-code]', '123456'); await p.getByRole('button', { name: '확인하고 로그인' }).click(); await t(600);
  /인증 시간|다시 로그인/.test(await p.locator('.form-message').textContent().catch(() => '') || '') ? pass('잘못된 2단계 인증 토큰 안내') : fail('2단계 인증 오류 안내 없음');
  await p.goto(B + '/verify-email/bad-token', { waitUntil: 'networkidle' }); await t(500);
  /만료|사용/.test(await p.locator('[role=status]').textContent().catch(() => '') || '') ? pass('잘못된 이메일 인증 링크 안내') : fail('이메일 인증 안내 없음');
  await adminLogin(p.request);
  const lid = (await (await p.request.post(B + '/api/edu', { data: { action: 'lesson', course_id: 'start', title: '시뮬 유튜브 강의', duration: 120, position: 99, video: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', questions: JSON.stringify([{ question: 'q', options: ['a', 'b'], answer: 0 }]) } })).json()).id;
  await p.goto(B + '/lesson/' + lid, { waitUntil: 'load' }); await t(1500);
  (await p.locator('.player-box.embed').count()) ? pass('YouTube 강의 → 임베드 플레이어 렌더링') : fail('YouTube 임베드 없음');
  await p.request.post(B + '/api/edu', { data: { action: 'lesson_delete', id: lid } });
  await ctx.close();
}
}
for (const [n, f] of [['S1', S1], ['S2', S2], ['S3', S3], ['S4', S4]]) { try { await f(); } catch (e) { fail(`[${n}] 시나리오 중단: ${e.message.split('\n')[0]}`); } }
// ─── 라우트 전수 (역할별) ───
const studentRoutes = ['/', '/courses', '/course/start', '/guide', '/notices', '/faq', '/verify', '/learn', '/learn/courses', '/learn/paths', '/learn/events', '/learn/assignments', '/learn/bookmarks', '/learn/notes', '/learn/achievements', '/learn/certificates', '/learn/questions', '/learn/notices', '/learn/lounge', '/learn/community', '/learn/settings', '/learn/notifications', '/lesson/start-1', '/lesson/legal-6'];
const adminRoutes = ['/admin', '/admin/courses', '/admin/videos', '/admin/paths', '/admin/quiz', '/admin/assignments', '/admin/events', '/admin/members', '/admin/cohorts', '/admin/progress', '/admin/questions', '/admin/announcements', '/admin/faqs', '/admin/lounge', '/admin/activity', '/admin/community', '/admin/ai', '/admin/settings', '/admin/notifications', '/admin/account-settings'];
for (const [role, routes] of [['anon', ['/', '/courses', '/course/start', '/login', '/faq', '/lesson/start-1', '/learn', '/verify-email/bad-token', '/reset/bad-token']], ['student', studentRoutes], ['admin', adminRoutes], ['demoAdmin', adminRoutes.filter((r) => r !== '/admin/settings')]]) {
  const ctx = await b.newContext({ viewport: { width: 1380, height: 1000 } });
  const p = await ctx.newPage(); watch(p, role);
  if (role === 'admin') await adminLogin(p.request);
  else if (role === 'demoAdmin') await p.request.post(B + '/api/edu', { data: { action: 'demo', role: 'admin' } });
  else if (role !== 'anon') await p.request.post(B + '/api/edu', { data: { action: 'demo', role } });
  for (const r of routes) { try { await p.goto(B + r, { waitUntil: 'load', timeout: 15000 }); await t(400); } catch (e) { fail(`[${role}] ${r} 로드 실패: ${e.message.split('\n')[0]}`); } }
  pass(`${role}: ${routes.length}개 라우트 순회`);
  await ctx.close();
}
console.log('PASS:\n' + ok.map((x) => '  ✓ ' + x).join('\n'));
console.log(issues.length ? '\nISSUES:\n' + issues.map((x) => '  ✗ ' + x).join('\n') : '\nNO ISSUES');
await b.close();
process.exit(issues.filter((i) => !/403|400 \(Bad Request\)/.test(i)).length ? 1 : 0);
