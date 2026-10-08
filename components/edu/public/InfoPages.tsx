'use client';
import { useEffect, useState } from 'react';
import { Plus, Pin, ShieldCheck, Search } from 'lucide-react';
import { useEdu } from '../../../lib/edu-store';
import { fmtDate, fmtShort } from '../../../lib/learning';
import { Button, Empty, Logo, PageHead, Pill } from '../ui';

const GUIDE = [
  ['01', '교육 가입 신청', '셀러브릭스 가입 셀러는 이메일 또는 카카오·네이버 계정으로 교육 가입을 신청합니다. 관리자가 셀러 자격을 확인하고 교육 기수를 배정합니다.'],
  ['02', '나의 강의실에서 학습', '교육 과정을 선택하고 영상을 시청하세요. 시청 위치가 저장되어 다음 접속 때 이어볼 수 있고, 배속·챕터·단축키로 편하게 학습할 수 있습니다.'],
  ['03', '확인 문제와 학습 노트', '영상을 기준 비율 이상 시청하면 확인 문제를 풀 수 있습니다. 통과 점수 이상을 받으면 강의가 완료되고, 재도전으로 최고 점수를 갱신할 수 있어요.'],
  ['04', '과제와 피드백', '과정에 실습 과제가 있으면 내용이나 링크를 제출하세요. 관리자가 검토 후 피드백과 통과 여부를 알려드립니다.'],
  ['05', '학습 기록과 배지', '연속 학습일, 주간 목표, 학습 히트맵과 배지로 나의 학습 습관을 돌아보세요.'],
  ['06', '수료증과 함께 성장', '과정을 모두 완료하면 검증 번호가 있는 수료증이 발급됩니다. 기수 동료의 채널을 살펴보고 콘텐츠에서 영감을 얻어보세요.'],
];
const FAQ = [
  ['셀러브릭스 회원이면 바로 교육을 받을 수 있나요?', '교육 가입 신청 후 관리자가 셀러 자격을 확인하고 승인하면 학습할 수 있습니다. 승인되면 알림으로 안내해 드려요.'],
  ['학습 진도는 어떻게 계산되나요?', '각 강의에서 기준 비율 이상 시청과 확인 문제 통과 점수를 충족하면 완료됩니다. 과정 진도는 전체 강의 중 완료 강의의 비율입니다.'],
  ['확인 문제를 다시 풀 수 있나요?', '네, 횟수 제한 없이 재도전할 수 있습니다. 최고 점수가 기록되고, 통과하면 강의가 완료 처리됩니다.'],
  ['모바일에서도 이용할 수 있나요?', '스마트폰에 맞춘 강의 카드와 접이식 메뉴로 학습할 수 있습니다. 영상 재생은 기기의 브라우저 환경에 따라 달라질 수 있습니다.'],
  ['기수와 동료 셀러는 어디서 확인하나요?', '나의 학습 대시보드에서 배정된 기수를 확인합니다. 셀러 채널 교류에서 기수와 플랫폼별로 공개된 채널을 찾아볼 수 있습니다.'],
  ['수료증은 어떻게 확인하나요?', '수료증에는 고유 검증 번호가 있습니다. 누구나 수료증 확인 페이지에서 번호로 진위를 확인할 수 있어요.'],
  ['카카오와 네이버 로그인은 언제 이용하나요?', '관리자가 연동 설정에서 앱 키를 등록하면 로그인 화면에서 바로 이용할 수 있습니다.'],
];

export function InfoPage({ kind }: { kind: 'guide' | 'notices' | 'faq' }) {
  const { data, go } = useEdu();
  const [open, setOpen] = useState<string | null>(null);
  const titles = { guide: ['셀러브릭스 에듀 학습 가이드', '나의 첫 학습부터 수료까지, 차근차근 안내해 드려요.'], notices: ['에듀 소식', '교육과 학습에 관한 새로운 안내를 확인하세요.'], faq: ['자주 묻는 질문', '시작하기 전에 궁금한 내용을 확인하세요.'] }[kind];
  const announcements = data?.announcements ?? [];
  return (
    <main className="container section info-page">
      <PageHead title={titles[0]} sub={titles[1]} />
      {kind === 'guide' && <div className="guide-grid">{GUIDE.map(([n, t, d]) => <div className="panel" key={n}><span className="guide-number">{n}</span><h2>{t}</h2><p>{d}</p></div>)}</div>}
      {kind === 'notices' && (announcements.length ? announcements.map((a) => (
        <article className={'panel notice-article ' + (open === a.id ? 'open' : '')} key={a.id}>
          <div className="between"><Pill>{a.pinned ? <><Pin size={12} /> 고정 공지</> : a.cohort_name ? a.cohort_name + ' 공지' : '전체 공지'}</Pill><small>{fmtShort(a.created)}</small></div>
          <h2><button onClick={() => setOpen(open === a.id ? null : a.id)}>{a.title}</button></h2>
          <p className={open === a.id ? 'full' : 'clamp'}>{a.body}</p>
        </article>
      )) : <Empty title="등록된 공지가 없어요" description="새로운 교육 안내가 등록되면 이곳에서 확인할 수 있습니다." />)}
      {kind === 'faq' && (
        <div>
          {FAQ.map(([q, a]) => <details className="panel faq-item" key={q}><summary>{q}<Plus size={19} /></summary><p>{a}</p></details>)}
          <div className="info-note" style={{ marginTop: 20 }}>더 궁금한 내용은 로그인 후 학습 Q&A에서 질문해 주세요. <button className="text-link" onClick={() => go('/login')}>로그인</button></div>
        </div>
      )}
    </main>
  );
}

export function VerifyPage({ code: initial }: { code?: string }) {
  const [code, setCode] = useState(initial || '');
  const [result, setResult] = useState<any>(null);
  const [state, setState] = useState<'idle' | 'loading' | 'done'>(initial ? 'loading' : 'idle');
  async function check(c: string) {
    if (!c.trim()) return;
    setState('loading');
    try {
      const r = await fetch('/api/edu?verify=' + encodeURIComponent(c.trim()), { cache: 'no-store' });
      setResult(await r.json());
    } catch {
      setResult({ ok: false, error: '확인 중 오류가 발생했습니다.' });
    }
    setState('done');
  }
  useEffect(() => {
    if (!initial) return;
    let alive = true;
    fetch('/api/edu?verify=' + encodeURIComponent(initial.trim()), { cache: 'no-store' })
      .then((r) => r.json())
      .catch(() => ({ ok: false, error: '확인 중 오류가 발생했습니다.' }))
      .then((j) => { if (alive) { setResult(j); setState('done'); } });
    return () => { alive = false; };
  }, [initial]);
  return (
    <main className="container section info-page narrow">
      <PageHead title="수료증 확인" sub="수료증에 표시된 검증 번호로 발급 여부를 확인할 수 있습니다." />
      <form className="panel verify-form" onSubmit={(e) => { e.preventDefault(); check(code); }}>
        <label>검증 번호<input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="SB-XXXXXXXXXX" /></label>
        <Button type="submit" disabled={state === 'loading'}><Search size={16} /> 확인하기</Button>
      </form>
      {state === 'done' && result && (
        result.ok ? (
          <div className="panel verify-result">
            <ShieldCheck size={36} className="purple" />
            <h2>유효한 수료증입니다</h2>
            <dl><dt>수료자</dt><dd>{result.certificate.name}</dd><dt>과정</dt><dd>{result.certificate.title}</dd><dt>발급일</dt><dd>{fmtDate(result.certificate.issued)}</dd><dt>검증 번호</dt><dd>{result.certificate.id}</dd></dl>
            <Logo />
          </div>
        ) : <Empty title="수료증을 찾을 수 없어요" description={result.error} />
      )}
    </main>
  );
}
