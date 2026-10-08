'use client';
import { useEffect, useState } from 'react';
import { MessageCircle, ShieldCheck, User, Lock, ArrowLeft } from 'lucide-react';
import { useEdu } from '../../../lib/edu-store';
import { Button, Logo } from '../ui';

const OAUTH_MESSAGES: Record<string, string> = {
  pending: '소셜 계정으로 가입 신청이 접수되었습니다. 관리자 승인 후 로그인할 수 있어요.',
  suspended: '이용이 중지된 계정입니다. 관리자에게 문의해 주세요.',
  state: '로그인 세션이 만료되었습니다. 다시 시도해 주세요.',
  failed: '소셜 로그인에 실패했습니다. 잠시 후 다시 시도해 주세요.',
  unavailable: '해당 소셜 로그인은 아직 연결되지 않았습니다.',
};

export function LoginPage({ redirectTo }: { redirectTo?: string }) {
  const { act, go, busy, data } = useEdu();
  const params = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams();
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>(params.get('mode') === 'register' ? 'register' : 'login');
  const [form, setForm] = useState({ email: '', password: '', name: '' });
  const [message, setMessage] = useState(OAUTH_MESSAGES[params.get('oauth') || ''] || '');
  const [agree, setAgree] = useState(false);
  const oauth = data?.oauth ?? { kakao: false, naver: false };
  const returnTo = redirectTo || params.get('return_to') || '/learn';

  useEffect(() => {
    if (params.get('oauth')) history.replaceState({}, '', '/login');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMessage('');
    if (mode === 'register' && !agree) return setMessage('교육 계정 신청과 개인정보 처리에 동의해 주세요.');
    try {
      if (mode === 'forgot') {
        const j = await act('forgot', { email: form.email });
        setMessage(j.message);
        return;
      }
      const j = await act(mode, form);
      if (mode === 'register') {
        setMessage(j.message);
        if (j.message?.includes('바로 로그인')) setMode('login');
      } else go(j.user?.role === 'admin' && returnTo === '/learn' ? '/admin' : returnTo);
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
        <span className="eyebrow">SELLERBRICKS ACADEMY</span>
        <h1>배움이 자신감으로,<br />자신감이 첫 판매로.</h1>
        <p>라이브 커머스의 첫 걸음을<br />셀러브릭스 에듀와 함께하세요.</p>
        <img src="/images/banner-1.webp" alt="라이브 커머스 셀러" />
        <div className="login-note"><ShieldCheck size={21} /><span>셀러브릭스 셀러를 위한 체계적인 교육</span></div>
      </div>
      <div className="login-form">
        <Logo />
        {mode === 'forgot' ? (
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
        <form onSubmit={submit}>
          {mode === 'register' && (
            <label>이름<input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="셀러 이름을 입력해 주세요" autoComplete="name" /></label>
          )}
          <label>이메일<input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="seller@example.com" autoComplete="email" /></label>
          {mode !== 'forgot' && (
            <label>비밀번호<input type="password" required minLength={mode === 'register' ? 10 : 1} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder={mode === 'register' ? '10자 이상 입력해 주세요' : '비밀번호를 입력해 주세요'} autoComplete={mode === 'register' ? 'new-password' : 'current-password'} /></label>
          )}
          {mode === 'register' && (
            <label className="check-label"><input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} /><span>교육 계정 신청에 동의합니다. 이름·이메일은 계정 승인과 학습 관리에 사용됩니다.</span></label>
          )}
          {message && <div className="form-message" role="status">{message}</div>}
          <button className="button full" disabled={busy} type="submit">{busy ? '처리 중…' : mode === 'register' ? '교육 가입 신청' : mode === 'forgot' ? '재설정 안내 받기' : '이메일로 로그인'}</button>
          {mode === 'login' && <button type="button" className="text-link forgot-link" onClick={() => { setMode('forgot'); setMessage(''); }}><Lock size={13} /> 비밀번호를 잊으셨나요?</button>}
        </form>
        {mode !== 'forgot' && (
          <>
            <div className="or"><span>또는 간편 로그인</span></div>
            <div className="social-buttons">
              <button className="kakao" onClick={() => social('kakao')}><MessageCircle size={19} fill="currentColor" /> 카카오 로그인 {!oauth.kakao && <small>준비 중</small>}</button>
              <button className="naver" onClick={() => social('naver')}><b>N</b> 네이버 로그인 {!oauth.naver && <small>준비 중</small>}</button>
            </div>
            <div className="demo-login">
              <b>먼저 둘러보고 싶으신가요?</b>
              <p>테스트 계정으로 교육생과 관리자 화면을 체험하세요.</p>
              <div>
                <Button secondary small disabled={busy} onClick={async () => { try { await act('demo', { role: 'student' }); go('/learn'); } catch (e: any) { setMessage(e.message); } }}><User size={16} /> 교육생 체험</Button>
                <Button secondary small disabled={busy} onClick={async () => { try { await act('demo', { role: 'admin' }); go('/admin'); } catch (e: any) { setMessage(e.message); } }}><ShieldCheck size={16} /> 최고 관리자 체험</Button>
              </div>
              <small>체험 계정의 학습·편집 기록은 공유됩니다.</small>
            </div>
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
  return (
    <div className="login-wrap single">
      <div className="login-form">
        <Logo />
        <h2>새 비밀번호 설정</h2>
        <p>10자 이상의 새 비밀번호를 입력해 주세요. 변경하면 모든 기기에서 다시 로그인해야 합니다.</p>
        <form onSubmit={async (e) => {
          e.preventDefault();
          if (pw.a !== pw.b) return setMessage('비밀번호 확인이 일치하지 않습니다.');
          try {
            const j = await act('reset', { token, password: pw.a });
            setMessage(j.message);
            if (j.message?.includes('로그인했습니다')) setTimeout(() => go('/learn'), 800);
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
