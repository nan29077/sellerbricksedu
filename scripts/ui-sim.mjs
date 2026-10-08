#!/usr/bin/env node
/**
 * 셀러브릭스 에듀 — 브라우저 UI 시뮬레이션 (Playwright)
 * 준비: npm i -g playwright && npx playwright install chromium   (또는 프로젝트 밖 임시 폴더에 설치)
 * 실행: 서버를 띄운 뒤  node scripts/ui-sim.mjs [http://127.0.0.1:3040]
 * 체험 계정과 테스트 데이터를 생성하므로 로컬/스테이징에서만 실행하세요.
 */
import { chromium } from 'playwright';
const B = process.argv[2] || 'http://127.0.0.1:3040';
const b = await chromium.launch();
const issues = [], ok = [];
const pass = (l) => ok.push(l);
const fail = (l) => issues.push(l);
function watch(p, tag) {
  p.on('pageerror', e => fail(`[${tag}] pageerror ${e.message}`));
  p.on('console', m => { if (m.type() === 'error' && !/favicon|404|net::ERR_ABORTED/.test(m.text())) fail(`[${tag}] console ${m.text().slice(0, 160)}`); });
  p.on('response', r => { if (r.status() >= 500) fail(`[${tag}] HTTP ${r.status()} ${r.url()}`); });
}
const t = (ms) => new Promise(r => setTimeout(r, ms));

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
  await p.check('input[type=checkbox]');
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
  const admin = await ctx.request.post(B + '/api/edu', { data: { action: 'demo', role: 'admin' } });
  const users = (await (await ctx.request.get(B + '/api/edu')).json()).users;
  const nu = users.find((u) => u.email === email);
  await ctx.request.post(B + '/api/edu', { data: { action: 'member', id: nu.id, status: 'active' } });
  await ctx.request.post(B + '/api/edu', { data: { action: 'logout' } });
  void admin;
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
  const ev = await ctx.request.post(B + '/api/edu', { data: { action: 'demo', role: 'admin' } }); void ev;
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
  await p.request.post(B + '/api/edu', { data: { action: 'demo', role: 'admin' } });
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
  (await p.locator('text=누구나 최고 관리자').count()) ? pass('체험 계정 경고 표시') : fail('체험 계정 경고 없음');
  // 과정 삭제 → 학습 경로·교육생 화면 안전
  await p.goto(B + '/admin/courses', { waitUntil: 'networkidle' });
  const card = p.locator('.admin-course', { hasText: '시뮬 과정' }).first();
  await card.locator('button[title=삭제]').click(); await t(300);
  await p.locator('[role=alertdialog] button', { hasText: '삭제' }).click(); await t(900);
  (await p.locator('text=시뮬 과정').count()) === 0 ? pass('과정 삭제 반영') : fail('과정 삭제 미반영');
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
for (const [n, f] of [['S1', S1], ['S2', S2], ['S3', S3]]) { try { await f(); } catch (e) { fail(`[${n}] 시나리오 중단: ${e.message.split('\n')[0]}`); } }
// ─── 라우트 전수 (역할별) ───
const studentRoutes = ['/', '/courses', '/course/start', '/guide', '/notices', '/faq', '/verify', '/learn', '/learn/courses', '/learn/paths', '/learn/events', '/learn/assignments', '/learn/bookmarks', '/learn/notes', '/learn/achievements', '/learn/certificates', '/learn/questions', '/learn/notices', '/learn/lounge', '/learn/community', '/learn/settings', '/lesson/start-1', '/lesson/legal-6'];
const adminRoutes = ['/admin', '/admin/courses', '/admin/videos', '/admin/paths', '/admin/quiz', '/admin/assignments', '/admin/events', '/admin/members', '/admin/cohorts', '/admin/progress', '/admin/questions', '/admin/announcements', '/admin/faqs', '/admin/lounge', '/admin/activity', '/admin/community', '/admin/ai', '/admin/settings'];
for (const [role, routes] of [['anon', ['/', '/courses', '/course/start', '/login', '/faq', '/lesson/start-1', '/learn']], ['student', studentRoutes], ['admin', adminRoutes]]) {
  const ctx = await b.newContext({ viewport: { width: 1380, height: 1000 } });
  const p = await ctx.newPage(); watch(p, role);
  if (role !== 'anon') await p.request.post(B + '/api/edu', { data: { action: 'demo', role } });
  for (const r of routes) { try { await p.goto(B + r, { waitUntil: 'load', timeout: 15000 }); await t(400); } catch (e) { fail(`[${role}] ${r} 로드 실패: ${e.message.split('\n')[0]}`); } }
  pass(`${role}: ${routes.length}개 라우트 순회`);
  await ctx.close();
}
console.log('PASS:\n' + ok.map((x) => '  ✓ ' + x).join('\n'));
console.log(issues.length ? '\nISSUES:\n' + issues.map((x) => '  ✗ ' + x).join('\n') : '\nNO ISSUES');
await b.close();
process.exit(issues.filter((i) => !/403|400 \(Bad Request\)/.test(i)).length ? 1 : 0);
