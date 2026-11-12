'use client';
import { useState } from 'react';
import { KeyRound, MailCheck, ShieldCheck } from 'lucide-react';
import { useEdu } from '../lib/edu-store';

export function CharacterAvatar({ index = 0, className = '' }: { index?: number; className?: string }) {
  const n = Math.max(0, Math.min(29, Number(index) || 0));
  return <span role="img" aria-label={`캐릭터 프로필 ${n + 1}`} className={'character-avatar ' + className} style={{ backgroundPosition: `${(n % 6) * 20}% ${Math.floor(n / 6) * 25}%` }} />;
}

/** 운영진 2단계 인증 (TOTP) */
function MfaSection({ user }: { user: any }) {
  const { act, busy, setToast, load } = useEdu();
  const [setup, setSetup] = useState<{ secret: string; uri: string; qr: string } | null>(null);
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState('');
  if (user.id.startsWith('demo-')) return null;
  async function start() {
    setMsg('');
    try {
      const j = await act('mfa_setup', {}, false);
      let qr = '';
      try { const QR = await import('qrcode'); qr = await QR.toDataURL(j.uri, { margin: 1, width: 180 }); } catch { /* QR 생성 실패 시 키 직접 입력 */ }
      setSetup({ secret: j.secret, uri: j.uri, qr });
    } catch (e: any) { setMsg(e.message); }
  }
  return (
    <section className="panel">
      <h2><ShieldCheck size={19} /> 2단계 인증</h2>
      {user.mfa ? (
        <form onSubmit={async (e) => { e.preventDefault(); setMsg(''); try { await act('mfa_disable', { code }); setCode(''); setToast('2단계 인증을 해제했습니다.'); } catch (err: any) { setMsg(err.message); } }}>
          <p className="muted">로그인할 때 인증 앱의 코드를 한 번 더 확인하고 있어요. 해제하려면 현재 코드를 입력하세요.</p>
          <label>인증 코드<input inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} placeholder="000000" /></label>
          {msg && <p className="form-message" role="alert">{msg}</p>}
          <button className="button secondary" disabled={busy || code.length !== 6}>2단계 인증 해제</button>
        </form>
      ) : setup ? (
        <form onSubmit={async (e) => { e.preventDefault(); setMsg(''); try { await act('mfa_enable', { code }); setSetup(null); setCode(''); await load(); setToast('2단계 인증을 켰습니다. 다른 기기의 로그인은 해제되었어요.'); } catch (err: any) { setMsg(err.message); } }}>
          <p className="muted">Google Authenticator·Microsoft Authenticator 등 인증 앱에서 QR 코드를 스캔하거나 키를 직접 입력한 뒤, 앱에 표시된 6자리 코드를 입력하세요.</p>
          <div className="mfa-setup">
            {setup.qr ? <img src={setup.qr} width={180} height={180} alt="인증 앱 등록 QR 코드" /> : null}
            <div><small className="muted">설정 키</small><code className="mfa-key">{setup.secret.replace(/(.{4})/g, '$1 ').trim()}</code><a className="text-link" href={setup.uri}>휴대폰에서 인증 앱으로 열기</a></div>
          </div>
          <label>인증 코드<input inputMode="numeric" autoComplete="one-time-code" maxLength={6} required value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} placeholder="000000" /></label>
          {msg && <p className="form-message" role="alert">{msg}</p>}
          <div className="row-actions"><button type="button" className="button secondary" onClick={() => setSetup(null)}>취소</button><button className="button" disabled={busy || code.length !== 6}>확인하고 켜기</button></div>
        </form>
      ) : (
        <>
          <p className="muted">관리자 계정은 비밀번호가 유출되어도 안전하도록 2단계 인증을 켜 두는 것을 권장합니다.</p>
          {msg && <p className="form-message" role="alert">{msg}</p>}
          <button className="button secondary" disabled={busy} onClick={start}><KeyRound size={16} /> 인증 앱 등록하기</button>
        </>
      )}
    </section>
  );
}

export default function AccountSettings({ user, busy, save }: { user: any; busy: boolean; save: (action: string, extra: any, message: string) => Promise<any> }) {
  const { act, data, admin, setToast } = useEdu();
  const [avatar, setAvatar] = useState(user.avatar ?? 0), [message, setMessage] = useState('');
  const demo = user.id.startsWith('demo-');
  const placeholderEmail = String(user.email).endsWith('@oauth.sellerbricks.local');
  async function submit(e: React.FormEvent<HTMLFormElement>, action: string) {
    e.preventDefault();
    const form = e.currentTarget, f = new FormData(form);
    setMessage('');
    const result = await save(action, action === 'profile' ? { name: f.get('name'), bio: f.get('bio') || '', avatar } : Object.fromEntries(f), action === 'password' && !user.has_password ? '비밀번호를 설정했습니다. 이제 이메일로도 로그인할 수 있어요.' : '변경 내용을 저장했습니다.');
    if (result) { setMessage('변경 내용을 저장했습니다.'); if (action === 'password') form.reset(); }
  }
  return (
    <div className="account-settings">
      <section className="panel">
        <div className="account-section-heading"><CharacterAvatar index={avatar} className="large" /><div><h2>나의 프로필</h2><p className="muted">동료 셀러에게 보여줄 이름과 캐릭터를 선택하세요.</p></div></div>
        <form onSubmit={(e) => submit(e, 'profile')}>
          <label>대화명<input name="name" defaultValue={user.name} required maxLength={30} minLength={2} autoComplete="nickname" /></label>
          <p className="small-muted">2~30자 · 지금까지 대화명을 {user.name_changes || 0}회 변경했습니다.</p>
          <label>한 줄 소개<textarea name="bio" defaultValue={user.bio || ''} maxLength={200} rows={2} placeholder="동료 셀러에게 보여줄 소개 (선택)" /></label>
          <fieldset className="avatar-fieldset"><legend>프로필 캐릭터 · 30종</legend><div className="avatar-choices">{Array.from({ length: 30 }, (_, i) => <button key={i} type="button" aria-label={`캐릭터 ${i + 1} 선택`} aria-pressed={avatar === i} className={avatar === i ? 'chosen' : ''} onClick={() => setAvatar(i)}><CharacterAvatar index={i} /></button>)}</div></fieldset>
          <button className="button" disabled={busy}>프로필 저장</button>
        </form>
      </section>
      <div className="account-secondary">
        <section className="panel">
          <h2>계정 정보</h2>
          <label>이메일<input value={placeholderEmail ? '(소셜 로그인 · 이메일 미제공)' : user.email} readOnly /></label>
          {!demo && !placeholderEmail && (
            user.email_verified
              ? <p className="small-muted"><MailCheck size={13} /> 확인된 이메일입니다.</p>
              : <p className="small-muted">이메일 주소가 아직 확인되지 않았어요.{data?.mailReady && <> <button type="button" className="text-link" disabled={busy} onClick={async () => { try { const j = await act('verify_send', {}, false); setToast(j.message); } catch (e: any) { setToast(e.message, 'error'); } }}>인증 메일 받기</button></>}</p>
          )}
          <label>계정 유형<input value={user.role === 'admin' ? '최고 관리자' : user.role === 'manager' ? '운영 관리자' : '셀러 교육생'} readOnly /></label>
          <p className="small-muted">가입일 · {new Date(user.created).toLocaleDateString('ko-KR')}</p>
        </section>
        <section className="panel">
          <h2>{user.has_password ? '비밀번호 변경' : '비밀번호 설정'}</h2>
          {demo ? <p className="muted">공유 체험 계정은 비밀번호를 변경할 수 없습니다. 이메일로 가입한 계정에서 이용해 주세요.</p> : (
            <form onSubmit={(e) => submit(e, 'password')}>
              {user.has_password
                ? <label>현재 비밀번호<input name="currentPassword" type="password" required autoComplete="current-password" /></label>
                : <p className="muted">소셜 로그인 또는 초대로 가입해 비밀번호가 없어요. 비밀번호를 설정하면 이메일로도 로그인할 수 있어요.</p>}
              <label>새 비밀번호<input name="newPassword" type="password" required minLength={10} maxLength={128} autoComplete="new-password" placeholder="10자 이상 입력하세요" /></label>
              <label>새 비밀번호 확인<input name="confirmPassword" type="password" required minLength={10} maxLength={128} autoComplete="new-password" /></label>
              <p className="small-muted">변경하면 다른 기기의 로그인은 해제되고 현재 기기의 로그인은 유지됩니다.</p>
              <button className="button" disabled={busy}>{user.has_password ? '비밀번호 변경' : '비밀번호 설정'}</button>
            </form>
          )}
        </section>
        {admin && <MfaSection user={user} />}
        <section className="panel">
          <h2>로그인 관리</h2>
          <p className="muted">현재 기기의 로그인은 유지하고 다른 기기의 로그인을 모두 해제합니다.</p>
          <button className="button secondary" disabled={busy} onClick={async () => { const r = await save('signoutOthers', {}, '다른 기기의 로그인을 해제했습니다.'); if (r) setMessage('다른 기기의 로그인을 해제했습니다.'); }}>다른 기기 로그아웃</button>
        </section>
      </div>
      {message && <p className="account-status" role="status">{message}</p>}
    </div>
  );
}
