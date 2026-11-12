import { first, run, batch, stmt, now, uid, bumpVersion } from './db';
import { createMfaChallenge } from './handlers/auth';
import { logActivity } from './notify';
import { createSession, randomAvatar } from './auth';
import { setCookie, cookie, siteUrl } from './http';
import { notifyAdmins } from './notify';

export type Provider = 'kakao' | 'naver';
export const PROVIDERS: Provider[] = ['kakao', 'naver'];
const STATE_COOKIE = 'edu_oauth_state';

const CONFIG = {
  kakao: {
    authorize: 'https://kauth.kakao.com/oauth/authorize',
    token: 'https://kauth.kakao.com/oauth/token',
    profile: 'https://kapi.kakao.com/v2/user/me',
    scope: 'profile_nickname account_email',
  },
  naver: {
    authorize: 'https://nid.naver.com/oauth2.0/authorize',
    token: 'https://nid.naver.com/oauth2.0/token',
    profile: 'https://openapi.naver.com/v1/nid/me',
    scope: '',
  },
};

export function redirectUri(req: Request, provider: Provider) {
  return `${siteUrl(req)}/api/auth/${provider}/callback`;
}

/** 1단계: 인가 페이지로 리다이렉트 */
export function startOAuth(req: Request, provider: Provider, settings: Record<string, string>, returnTo: string) {
  const client = settings[`${provider}_client`];
  if (!client || !settings[`${provider}_secret`]) return redirectWithMessage(req, 'unavailable');
  const state = uid() + ':' + encodeURIComponent(returnTo.startsWith('/') && !returnTo.startsWith('//') ? returnTo : '/learn');
  const url = new URL(CONFIG[provider].authorize);
  url.searchParams.set('client_id', client);
  url.searchParams.set('redirect_uri', redirectUri(req, provider));
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('state', state);
  if (CONFIG[provider].scope) url.searchParams.set('scope', CONFIG[provider].scope);
  return new Response(null, { status: 302, headers: { Location: url.toString(), 'Set-Cookie': setCookie(STATE_COOKIE, state, 600, req) } });
}

function redirectWithMessage(req: Request, code: string, extra = '') {
  return new Response(null, { status: 302, headers: { Location: `${siteUrl(req)}/login?oauth=${code}${extra}`, 'Set-Cookie': setCookie(STATE_COOKIE, '', 0, req) } });
}

/** 2단계: 콜백 — 토큰 교환 → 프로필 → 계정 매핑 → 세션 */
export async function finishOAuth(req: Request, provider: Provider, settings: Record<string, string>) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code'), state = url.searchParams.get('state') || '';
  const saved = cookie(req, STATE_COOKIE) || '';
  if (!code || !state || state !== saved) return redirectWithMessage(req, 'state');
  let returnTo = '/learn';
  try { returnTo = decodeURIComponent(state.split(':').slice(1).join(':') || '/learn'); } catch { /* 잘못된 state */ }
  if (!returnTo.startsWith('/') || returnTo.startsWith('//')) returnTo = '/learn';
  const client = settings[`${provider}_client`], secret = settings[`${provider}_secret`];
  if (!client || !secret) return redirectWithMessage(req, 'unavailable');

  try {
    const tokenRes = await fetch(CONFIG[provider].token, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
      body: new URLSearchParams({ grant_type: 'authorization_code', client_id: client, client_secret: secret, redirect_uri: redirectUri(req, provider), code, state }),
    });
    const token: any = await tokenRes.json();
    if (!tokenRes.ok || !token.access_token) throw new Error('token');
    const profRes = await fetch(CONFIG[provider].profile, { headers: { Authorization: 'Bearer ' + token.access_token } });
    const prof: any = await profRes.json();
    if (!profRes.ok) throw new Error('profile');

    let providerId = '', email = '', name = '', emailVerified = false;
    if (provider === 'kakao') {
      providerId = String(prof.id || '');
      emailVerified = prof.kakao_account?.is_email_valid === true && prof.kakao_account?.is_email_verified === true;
      email = emailVerified ? prof.kakao_account?.email || '' : '';
      name = prof.kakao_account?.profile?.nickname || prof.properties?.nickname || '';
    } else {
      providerId = String(prof.response?.id || '');
      email = prof.response?.email || ''; // 네이버는 인증된 이메일만 제공
      emailVerified = !!email;
      name = prof.response?.name || prof.response?.nickname || '';
    }
    if (!providerId) throw new Error('id');
    name = (name || `${provider === 'kakao' ? '카카오' : '네이버'} 셀러`).slice(0, 30);
    email = (email || `${provider}-${providerId}@oauth.sellerbricks.local`).toLowerCase();

    // 기존 소셜 매핑 → 그 사용자. 없으면 같은 이메일의 계정에 연결, 그것도 없으면 새 계정.
    let userId = (await first<any>('SELECT user_id FROM oauth_accounts WHERE provider=? AND provider_id=?', provider, providerId))?.user_id;
    if (!userId) {
      // 검증된 이메일일 때만 기존 계정에 연결 (계정 탈취 방지)
      const existing = emailVerified ? await first<any>('SELECT id, password, email_verified FROM users WHERE email=?', email) : null;
      if (existing) {
        userId = existing.id;
        // 이메일 인증을 거치지 않은 비밀번호 계정이면, 타인이 먼저 가입해 둔 계정일 수 있다.
        // 소셜 제공자가 이메일 소유를 확인했으므로 기존 비밀번호와 세션을 무효화하고 소유자에게 넘긴다.
        if (existing.password && !existing.email_verified) {
          await batch([stmt('UPDATE users SET password=NULL WHERE id=?', userId), stmt('DELETE FROM sessions WHERE user_id=?', userId), stmt('DELETE FROM password_resets WHERE user_id=?', userId)]);
          await logActivity(userId, 'oauth_takeover_guard', provider);
        }
        await run('UPDATE users SET email_verified=1 WHERE id=?', userId);
      } else {
        userId = uid();
        const auto = settings.oauth_auto_approve === '1';
        await batch([
          stmt('INSERT INTO users (id,email,name,role,password,status,created,email_verified) VALUES (?,?,?,?,NULL,?,?,?)', userId, email, name, 'student', auto ? 'active' : 'pending', now(), emailVerified ? 1 : 0),
          stmt('INSERT INTO user_profiles (user_id,avatar) VALUES (?,?)', userId, randomAvatar()),
        ]);
        await notifyAdmins('approval', auto ? '소셜 로그인으로 새 교육생이 가입했습니다' : '승인 대기 교육생이 있습니다', `${name} (${provider})`, '/admin/members');
      }
      await run('INSERT OR IGNORE INTO oauth_accounts (provider,provider_id,user_id,created) VALUES (?,?,?,?)', provider, providerId, userId, now());
      await bumpVersion();
    }
    const user = await first<any>('SELECT * FROM users WHERE id=?', userId);
    if (!user) throw new Error('user');
    if (user.status === 'pending') return redirectWithMessage(req, 'pending');
    if (user.status !== 'active') return redirectWithMessage(req, 'suspended');
    // 2단계 인증을 켠 운영진은 코드 확인 후 로그인
    if (await first('SELECT 1 FROM user_profiles WHERE user_id=? AND totp_enabled=1', user.id)) {
      const token = await createMfaChallenge(user.id, returnTo);
      return redirectWithMessage(req, 'mfa', `&mfa=${token}`);
    }
    const s = await createSession(req, user);
    const headers = new Headers({ Location: `${siteUrl(req)}${returnTo}` });
    headers.append('Set-Cookie', s.header);
    headers.append('Set-Cookie', setCookie(STATE_COOKIE, '', 0, req));
    return new Response(null, { status: 302, headers });
  } catch (e) {
    console.error('oauth failed', provider, e);
    return redirectWithMessage(req, 'failed');
  }
}
