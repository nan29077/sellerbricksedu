'use client';
import { useState } from 'react';
import { UserX } from 'lucide-react';
import { useEdu } from '../../../lib/edu-store';

/** 계정 설정 하단: 회원 탈퇴 */
export function WithdrawSection() {
  const { user, act, busy, setToast } = useEdu();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');
  const [ack, setAck] = useState(false);
  const [error, setError] = useState('');
  if (!user) return null;
  const demo = user.id.startsWith('demo-');
  const hasPassword = !!user.has_password;
  return (
    <section className="panel withdraw-panel">
      <h2><UserX size={20} /> 회원 탈퇴</h2>
      {demo ? <p className="muted">공유 체험 계정은 탈퇴할 수 없습니다.</p> : !open ? (
        <>
          <p className="muted">탈퇴하면 학습 진도, 노트, 과제, 게시물과 수료증이 모두 삭제되며 복구할 수 없습니다.</p>
          <button className="button secondary danger-outline" onClick={() => setOpen(true)}>탈퇴 진행</button>
        </>
      ) : (
        <form onSubmit={async (e) => {
          e.preventDefault();
          setError('');
          if (!ack) return setError('삭제 안내를 확인하고 체크해 주세요.');
          try {
            await act('withdraw', hasPassword ? { password: value } : { confirm: value });
            setToast('탈퇴가 완료되었습니다. 그동안 함께해 주셔서 감사합니다.');
            setTimeout(() => { location.href = '/'; }, 900);
          } catch (err: any) { setError(err.message); }
        }}>
          <div className="info-note warn">학습 진도·노트·과제·게시물·댓글·수료증이 <b>즉시 삭제</b>되며 되돌릴 수 없습니다. 같은 이메일로 다시 가입하면 새 계정으로 시작합니다.</div>
          {hasPassword
            ? <label>현재 비밀번호<input type="password" value={value} onChange={(e) => setValue(e.target.value)} required autoComplete="current-password" /></label>
            : <label>확인을 위해 <b>탈퇴</b>를 입력하세요<input value={value} onChange={(e) => setValue(e.target.value)} required placeholder="탈퇴" /></label>}
          <label className="check-label"><input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} /><span>삭제되는 내용을 확인했으며 탈퇴에 동의합니다.</span></label>
          {error && <div className="form-message" role="alert">{error}</div>}
          <div className="row-actions">
            <button type="button" className="button secondary" onClick={() => { setOpen(false); setValue(''); setAck(false); setError(''); }}>취소</button>
            <button className="button danger" disabled={busy}>탈퇴하기</button>
          </div>
        </form>
      )}
    </section>
  );
}
