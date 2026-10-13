#!/usr/bin/env node
/**
 * 로컬 미리보기 실행기 (Windows 배치 파일에서 호출)
 *   node scripts/local-run.mjs dev      개발 서버 (코드 수정 즉시 반영)
 *   node scripts/local-run.mjs preview  운영과 같은 빌드 후 실행
 *
 * - corepack/pnpm 없이도 실행 (node_modules 가 있으면 node 로 바로 실행)
 * - node_modules 가 없을 때만 설치: corepack pnpm → npx pnpm 순서로 시도
 * - 포트 3040 사용 여부 확인, 서버 응답을 확인한 뒤 브라우저 열기
 */
import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
process.chdir(root);
const mode = process.argv[2] === 'preview' ? 'preview' : 'dev';
const PORT = 3040;
const URL_ = `http://127.0.0.1:${PORT}`;
const win = process.platform === 'win32';
const noOpen = process.argv.includes('--no-open') || process.env.EDU_NO_OPEN === '1';

const line = '='.repeat(60);
const say = (m = '') => console.log('  ' + m);
const fail = (m) => { console.log('\n  ' + '-'.repeat(58)); say('[오류] ' + m); console.log('  ' + '-'.repeat(58)); process.exit(1); };

console.log('\n ' + line);
say(`셀러브릭스 에듀 - ${mode === 'dev' ? '개발 서버' : '빌드 미리보기'}`);
console.log(' ' + line);
say(`주소 : ${URL_}`);
say('종료 : 이 창에서 Ctrl + C (또는 창 닫기)');
console.log(' ' + line + '\n');

// 1) Node 버전
const [maj, min] = process.versions.node.split('.').map(Number);
if (maj < 22 || (maj === 22 && min < 13)) fail(`Node.js ${process.versions.node} 은(는) 너무 낮습니다. 22.13 이상(24 LTS 권장)을 설치해 주세요. https://nodejs.org`);

// 2) 패키지 설치 (없을 때만)
function run(cmd, args) {
  say(`> ${cmd} ${args.join(' ')}`);
  const r = spawnSync(cmd, args, { stdio: 'inherit', shell: win, env: { ...process.env, COREPACK_ENABLE_DOWNLOAD_PROMPT: '0', CI: '1' } });
  return r.status === 0;
}
const installed = () => ['vinext/dist/cli.js', 'wrangler/bin/wrangler.js'].every((p) => existsSync(path.join(root, 'node_modules', p)));
if (!installed()) {
  say('처음 실행이라 패키지를 설치합니다. 3~5분 걸릴 수 있어요...\n');
  const ok = run('corepack', ['pnpm', 'install']) || (say('corepack 실행이 안 되어 npx 로 다시 시도합니다...'), run('npx', ['-y', 'pnpm@11.25.0', 'install']));
  if (!ok || !installed()) fail('패키지 설치에 실패했습니다. 인터넷 연결을 확인하고 다시 실행해 주세요.');
  console.log();
}

// 3) 포트 확인
const portFree = () => new Promise((res) => {
  const s = net.createServer().once('error', () => res(false)).once('listening', () => s.close(() => res(true)));
  s.listen(PORT, '127.0.0.1');
});
async function alive() {
  try { const r = await fetch(URL_ + '/api/edu', { signal: AbortSignal.timeout(3000) }); return r.status < 500; } catch { return false; }
}
function openBrowser() {
  if (noOpen) return;
  try {
    if (win) spawn('cmd', ['/c', 'start', '""', URL_], { detached: true, stdio: 'ignore', windowsVerbatimArguments: true }).unref();
    else if (process.platform === 'darwin') spawn('open', [URL_], { detached: true, stdio: 'ignore' }).unref();
    else spawn('xdg-open', [URL_], { detached: true, stdio: 'ignore' }).on('error', () => {}).unref();
  } catch { /* 브라우저를 못 열어도 서버는 계속 */ }
}

if (!(await portFree())) {
  if (await alive()) {
    say('이미 3040 포트에서 서버가 실행 중입니다. 브라우저만 엽니다.');
    say('(새로 실행하려면 기존 서버 창을 먼저 닫아 주세요.)');
    openBrowser();
    process.exit(0);
  }
  fail('3040 포트를 다른 프로그램이 사용 중입니다. 기존 서버 창(검은 창)을 닫거나 PC를 재시작한 뒤 다시 실행해 주세요.');
}

// 4) 빌드 (미리보기 모드)
if (mode === 'preview') {
  say('[1/2] 빌드 중입니다. 1~2분 걸립니다...\n');
  if (spawnSync(process.execPath, ['scripts/run-framework.mjs', 'build'], { stdio: 'inherit' }).status !== 0) fail('빌드에 실패했습니다. 위의 메시지를 확인해 주세요.');
  say('\n[2/2] 서버를 시작합니다...\n');
}

// 5) 서버 실행
const args = mode === 'dev'
  ? ['scripts/run-framework.mjs', 'dev']
  : ['--import', './scripts/sites-env.mjs', './node_modules/wrangler/bin/wrangler.js', 'dev', '--config', 'dist/server/wrangler.json', '--local', '--persist-to', '.wrangler/state', '--ip', '127.0.0.1', '--inspector-port', '0', '--port', String(PORT)];
const child = spawn(process.execPath, args, { stdio: 'inherit' });
child.on('error', (e) => fail('서버를 시작하지 못했습니다: ' + e.message));
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { child.kill(sig); });

// 서버가 응답하면 브라우저 열기 (최대 3분 대기)
(async () => {
  const until = Date.now() + 180000;
  while (Date.now() < until && child.exitCode === null) {
    if (await alive()) { say(`\n  준비 완료 → ${URL_} 을 브라우저로 엽니다.\n`); openBrowser(); return; }
    await new Promise((r) => setTimeout(r, 1500));
  }
})();

child.on('exit', (code) => {
  if (code && code !== 0 && code !== 130 && code !== 3221225786) fail(`서버가 종료되었습니다 (코드 ${code}). 위의 메시지를 확인해 주세요.`);
  process.exit(0);
});
