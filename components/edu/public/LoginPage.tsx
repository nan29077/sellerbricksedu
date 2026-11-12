'use client';
import { useEffect, useState } from 'react';
import { MessageCircle, ShieldCheck, User, Lock, ArrowLeft, KeyRound, MailCheck } from 'lucide-react';
import { useEdu } from '../../../lib/edu-store';
import { Button, Logo } from '../ui';

const OAUTH_MESSAGES: Record<string, string> = {
  pending: '소셜 계정으로 가입 신청이 접수되었습니다. 관리자 승인 후 로그인할 수 있어요.',
  suspended: '이용이 중지된 계정입니다. 관리자에게 문의해 주세요.',
  state: '로그인 세션이 만료되었습니다. 다시 시도해 주세요.',
  failed: '소셜 로그인에 실패했습니다. 잠시 후 다시 시도해 주세요.',
  unavailable: '해당 소셜 로그인은 아직 연결되지 않았습니다.',
  mfa: '2단계 인증을 사용하는 계정입니다. 인증 앱의 6자리 코드를 입력해 주세요.',
};

/** 2단계 인증 코드 입력 */
function MfaStep({ token, onDone, onCancel }: { token: string; onDone: (j: any) => void; onCancel: () => void }) {
  const { act, busy } = useEdu();
  const [code, setCode] = useState('');
  const [message, setMessage] = useState('');
  return (
    <form onSubmit={async (e) => {
      e.preventDefault();
      setMessage('');
      try { onDone(await act('login_mfa', { token, code })); } catch (err: any) { setMessage(err.message); }
    }}>
      <div className="info-note"><KeyRound size={17} /> 인증 앱(Google Authenticator 등)에 표시된 6자리 코드를 입력해 주세요.</div>
      <label>인증 코드<input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required autoFocus value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} placeholder="000000" /></label>
      {message && <div className="form-message" role="alert">{message}</div>}
      <button className="button full" disabled={busy || code.length !== 6} type="submit">{busy ? '확인 중…' : '확인하고 로그인'}</button>
      <button type="button" className="text-link" onClick={onCancel}>처음부터 다시 로그인</button>
    </form>
  );
}

export function LoginPage({ redirectTo }: { redirectTo?: string }) {
  const { act, go, busy, data } = useEdu();
  const params = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams();
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>(params.get('mode') === 'register' ? 'register' : 'login');
  const [form, setForm] = useState({ email: '', password: '', name: '' });
  const [message, setMessage] = useState(OAUTH_MESSAGES[params.get('oauth') || ''] || '');
  const [agree, setAgree] = useState({ terms: false, privacy: false, age: false });
  const allAgreed = agree.terms && agree.privacy && agree.age;
  const oauth = data?.oauth ?? { kakao: false, naver: false };
  const returnTo = (() => { const r = redirectTo || params.get('return_to') || '/learn'; return r.startsWith('/') && !r.startsWith('//') ? r : '/learn'; })();
  const [mfa, setMfa] = useState(params.get('mfa') || '');
  const finish = (j: any) => { const to = j.returnTo || returnTo; go((j.user?.role === 'admin' || j.user?.role === 'manager') && to === '/learn' ? '/admin' : to); };

  useEffect(() => {
    if (params.get('oauth') || params.get('mfa')) history.replaceState({}, '', '/login');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMessage('');
    if (mode === 'register' && !allAgreed) return setMessage('필수 항목(이용약관, 개인정보 수집·이용, 만 14세 이상)에 모두 동의해 주세요.');
    try {
      if (mode === 'forgot') {
        const j = await act('forgot', { email: form.email });
        setMessage(j.message);
        return;
      }
      const j = await act(mode, mode === 'register' ? { ...form, agree: true } : form);
      if (mode === 'register') {
        setMessage(j.message);
        if (j.message?.includes('바로 로그인')) setMode('login');
      } else if (j.mfa) setMfa(j.mfa);
      else finish(j);
    } catch (err: any) {
      setMessage(err.message);
    }
  }

  const social = (provider: 'kakao' | 'naver') => {
    if (!oauth[provider]) return setMessage(`${provider === 'kakao' ? '카카오' : '네이버'} 로그인은 준비 중입니다. 관리자가 연동을 완료하면 이용할 수 있어요.`);
    location.href = `/api/auth/${provider}?return_to=${encodeURIComponent(returnTo)}`;
  };

  return (
    <div className="login-wrap">
      <div className="login-story">
        <span className="eyebrow">SELLERBRICKS CAMPUS</span>
        <h1>배움이 자신감으로,<br />자신감이 첫 판매로.</h1>
        <p>라이브 커머스의 첫 걸음을<br />셀러브릭스 캠퍼스와 함께하세요.</p>
        <img src="/images/banner-1.webp" alt="라이브 커머스 셀러" />
        <div className="login-note"><ShieldCheck size={21} /><span>셀러브릭스 셀러를 위한 체계적인 교육</span></div>
      </div>
      <div className="login-form">
        <Logo onClick={() => go('/')} />
        {mfa ? (
          <>
            <h2>2단계 인증</h2>
            <p>계정 보호를 위해 한 번 더 확인할게요.</p>
            <MfaStep token={mfa} onDone={finish} onCancel={() => { setMfa(''); setMessage(''); }} />
          </>
        ) : mode === 'forgot' ? (
          <>
            <button className="text-link back-link" onClick={() => { setMode('login'); setMessage(''); }}><ArrowLeft size={15} /> 로그인으로</button>
            <h2>비밀번호를 잊으셨나요?</h2>
            <p>가입한 이메일을 입력하면 재설정 안내를 보내드려요. 메일 설정이 없는 경우 관리자가 링크를 전달합니다.</p>
          </>
        ) : (
          <>
            <h2>{mode === 'login' ? '다시 만나서 반가워요.' : '셀러의 성장을 시작하세요.'}</h2>
            <p>{mode === 'login' ? '로그인하고 나의 학습을 이어가세요.' : '셀러브릭스 가입 셀러인지 확인 후 교육 계정이 승인됩니다.'}</p>
            <div className="login-tabs">
              <button className={mode === 'login' ? 'selected' : ''} onClick={() => { setMode('login'); setMessage(''); }}>로그인</button>
              <button className={mode === 'register' ? 'selected' : ''} onClick={() => { setMode('register'); setMessage(''); }}>교육 가입 신청</button>
            </div>
          </>
        )}
        {!mfa && <form onSubmit={submit}>
          {mode === 'register' && (
            <label>이름<input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="셀러 이름을 입력해 주세요" autoComplete="name" /></label>
          )}
          <label>이메일<input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="seller@example.com" autoComplete="email" /></label>
          {mode !== 'forgot' && (
            <label>비밀번호<input type="password" required minLength={mode === 'register' ? 10 : 1} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder={mode === 'register' ? '10자 이상 입력해 주세요' : '비밀번호를 입력해 주세요'} autoComplete={mode === 'register' ? 'new-password' : 'current-password'} /></label>
          )}
          {mode === 'register' && (
            <div className="consent-box">
              <label className="check-label consent-all"><input type="checkbox" checked={allAgreed} onChange={(e) => setAgree({ terms: e.target.checked, privacy: e.target.checked, age: e.target.checked })} /><span>필수 항목 전체 동의</span></label>
              <label className="check-label"><input type="checkbox" checked={agree.terms} onChange={(e) => setAgree({ ...agree, terms: e.target.checked })} /><span>[필수] 이용약관 동의</span><a href="/terms" target="_blank" rel="noopener">보기</a></label>
              <label className="check-label"><input type="checkbox" checked={agree.privacy} onChange={(e) => setAgree({ ...agree, privacy: e.target.checked })} /><span>[필수] 개인정보 수집·이용 동의 <small>이름·이메일 / 계정 승인·학습 관리 / 탈퇴 시까지</small></span><a href="/privacy" target="_blank" rel="noopener">보기</a></label>
              <label className="check-label"><input type="checkbox" checked={agree.age} onChange={(e) => setAgree({ ...agree, age: e.target.checked })} /><span>[필수] 만 14세 이상입니다</span></label>
            </div>
          )}
          {message && <div className="form-message" role="status">{message}</div>}
          <button className="button full" disabled={busy} type="submit">{busy ? '처리 중…' : mode === 'register' ? '교육 가입 신청' : mode === 'forgot' ? '재설정 안내 받기' : '이메일로 로그인'}</button>
          {mode === 'login' && <button type="button" className="text-link forgot-link" onClick={() => { setMode('forgot'); setMessage(''); }}><Lock size={13} /> 비밀번호를 잊으셨나요?</button>}
        </form>}
        {mode !== 'forgot' && !mfa && (
          <>
            <div className="or"><span>또는 간편 로그인</span></div>
            <div className="social-buttons">
              <button className="kakao" onClick={() => social('kakao')}><MessageCircle size={19} fill="currentColor" /> 카카오 로그인 {!oauth.kakao && <small>준비 중</small>}</button>
              <button className="naver" onClick={() => social('naver')}><b>N</b> 네이버 로그인 {!oauth.naver && <small>준비 중</small>}</button>
            </div>
            <p className="social-consent">간편 로그인으로 처음 가입하면 <a href="/terms" target="_blank" rel="noopener">이용약관</a>과 <a href="/privacy" target="_blank" rel="noopener">개인정보처리방침</a>에 동의하고 만 14세 이상임을 확인한 것으로 봅니다.</p>
            {data?.settings?.demo_mode !== '0' && <div className="demo-login">
              <b>먼저 둘러보고 싶으신가요?</b>
              <p>테스트 계정으로 교육생과 관리자 화면을 체험하세요.</p>
              <div>
                <Button secondary small disabled={busy} onClick={async () => { try { await act('demo', { role: 'student' }); go('/learn'); } catch (e: any) { setMessage(e.message); } }}><User size={16} /> 교육생 체험</Button>
                <Button secondary small disabled={busy} onClick={async () => { try { await act('demo', { role: 'admin' }); go('/admin'); } catch (e: any) { setMessage(e.message); } }}><ShieldCheck size={16} /> 최고 관리자 체험</Button>
              </div>
              <small>체험 계정은 여러 사람이 함께 쓰며, 관리자 체험은 둘러보기만 가능합니다.</small>
            </div>}
          </>
        )}
      </div>
    </div>
  );
}

export function ResetPage({ token }: { token: string }) {
  const { act, go, busy } = useEdu();
  const [pw, setPw] = useState({ a: '', b: '' });
  const [message, setMessage] = useState('');
  const [mfa, setMfa] = useState('');
  if (mfa) return (
    <div className="login-wrap single"><div className="login-form"><Logo onClick={() => go('/')} /><h2>2단계 인증</h2><p>비밀번호를 변경했습니다. 인증 앱의 코드를 입력하면 로그인됩니다.</p>
      <MfaStep token={mfa} onDone={(j) => go(j.user?.role === 'student' ? '/learn' : '/admin')} onCancel={() => go('/login')} /></div></div>
  );
  return (
    <div className="login-wrap single">
      <div className="login-form">
        <Logo onClick={() => go('/')} />
        <h2>새 비밀번호 설정</h2>
        <p>10자 이상의 새 비밀번호를 입력해 주세요. 변경하면 모든 기기에서 다시 로그인해야 합니다.</p>
        <form onSubmit={async (e) => {
          e.preventDefault();
          if (pw.a !== pw.b) return setMessage('비밀번호 확인이 일치하지 않습니다.');
          try {
            const j = await act('reset', { token, password: pw.a });
            setMessage(j.message);
            if (j.mfa) setMfa(j.mfa);
            else if (j.message?.includes('로그인했습니다')) setTimeout(() => go('/learn'), 800);
          } catch (err: any) { setMessage(err.message); }
        }}>
          <label>새 비밀번호<input type="password" required minLength={10} value={pw.a} onChange={(e) => setPw({ ...pw, a: e.target.value })} autoComplete="new-password" /></label>
          <label>새 비밀번호 확인<input type="password" required minLength={10} value={pw.b} onChange={(e) => setPw({ ...pw, b: e.target.value })} autoComplete="new-password" /></label>
          {message && <div className="form-message" role="status">{message}</div>}
          <button className="button full" disabled={busy} type="submit">비밀번호 변경</button>
        </form>
        <button className="text-link" onClick={() => go('/login')}>로그인으로 돌아가기</button>
      </div>
    </div>
  );
}

/** 이메일 인증 링크 */
export function VerifyEmailPage({ token }: { token: string }) {
  const { act, go, user } = useEdu();
  const [state, setState] = useState<{ ok: boolean; message: string } | null>(null);
  useEffect(() => {
    let alive = true;
    act('verify_email', { token }).then((j) => alive && setState({ ok: true, message: j.message }), (e) => alive && setState({ ok: false, message: e.message }));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);
  return (
    <div className="login-wrap single">
      <div className="login-form">
        <Logo onClick={() => go('/')} />
        <h2><MailCheck size={22} /> 이메일 확인</h2>
        <p role="status">{state ? state.message : '확인하고 있어요…'}</p>
        {state && <Button onClick={() => go(user ? '/learn' : '/login')}>{user ? '나의 학습으로' : '로그인하기'}</Button>}
      </div>
    </div>
  );
}
