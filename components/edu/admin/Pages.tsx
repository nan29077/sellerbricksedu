'use client';
import { useState } from 'react';
import { Plus, GraduationCap, PenLine, Trash2, Pin, Megaphone, ClipboardList, ExternalLink, Sparkles, Copy, Lock, Mail, KeyRound, Settings2, CheckCircle2, Video, Eye, EyeOff } from 'lucide-react';
import { useEdu } from '../../../lib/edu-store';
import { fmtShort, relTime } from '../../../lib/learning';
import { Button, Empty, PageHead, Pill, ProgressBar, Tabs } from '../ui';
import { ContentTransfer } from './Extras';

export function AdminCohorts() {
  const { data, lessons, openModal, perform, ask, go, superAdmin } = useEdu();
  if (!data) return null;
  const label: Record<string, string> = { recruiting: '모집 중', active: '교육 중', completed: '교육 종료' };
  return (
    <>
      <PageHead title="기수 관리" sub="교육 기간과 참여 교육생을 기수별로 구성하고 학습 현황을 확인하세요." action={<Button small onClick={() => openModal('cohort', { name: '', starts: '', ends: '', description: '', status: 'recruiting' })}><Plus size={17} /> 기수 등록</Button>} />
      <div className="members-grid">
        {data.cohorts.map((c) => {
          const ids = (data.memberships ?? []).filter((m) => m.cohort_id === c.id).map((m) => m.user_id);
          const ps = (data.allProgress ?? []).filter((p) => ids.includes(p.user_id));
          const pc = ids.length && lessons.length ? Math.round((ps.filter((p) => p.complete).length / (ids.length * lessons.length)) * 100) : 0;
          const certs = (data.allCertificates ?? []).filter((x) => ids.includes(x.user_id)).length;
          return (
            <div className="panel" key={c.id}>
              <div className="between"><GraduationCap className="purple" size={28} /><Pill tone={c.status === 'active' ? 'good' : c.status === 'recruiting' ? 'info' : ''}>{label[c.status]}</Pill></div>
              <h2>{c.name}</h2>
              <p className="muted">{c.starts ? fmtShort(c.starts) : '시작일 미정'} ~ {c.ends ? fmtShort(c.ends) : '종료일 미정'}</p>
              <p>{c.description}</p>
              <ProgressBar value={pc} label={`${ids.length}명 · 평균 완료율`} />
              <div className="member-metrics"><span>수료 {certs}건</span><span>공지 {data.announcements.filter((a) => a.cohort_id === c.id).length}개</span></div>
              <div className="admin-actions">
                <Button small secondary onClick={() => openModal('cohort', c)}><PenLine size={14} /> 편집</Button>
                <Button small secondary onClick={() => go('/admin/members?cohort=' + c.id)}>교육생 {ids.length}명</Button>
                <Button small secondary onClick={() => openModal('announcement', { title: '', body: '', cohortId: c.id, pinned: 0 })}><Megaphone size={14} /> 공지</Button>
                {superAdmin && <Button small secondary danger onClick={async () => { if (await ask(`'${c.name}' 기수를 삭제할까요?`, '소속 교육생은 미배정 상태가 됩니다.', { danger: true, confirmLabel: '삭제' })) perform('cohort_delete', { id: c.id }, '기수를 삭제했습니다.'); }}><Trash2 size={14} /></Button>}
              </div>
            </div>
          );
        })}
      </div>
      {!data.cohorts.length && <Empty title="첫 기수를 만들어 보세요" description="1기, 2기 등 기수를 등록한 후 교육생 관리에서 교육생을 배정하세요." />}
    </>
  );
}

export function AdminAnnouncements() {
  const { data, openModal, perform, ask } = useEdu();
  if (!data) return null;
  return (
    <>
      <PageHead title="공지 관리" sub="전체 또는 기수별 공지를 등록하면 교육생에게 알림이 전달됩니다." action={<Button small onClick={() => openModal('announcement', { title: '', body: '', cohortId: '', pinned: 0, notify: true })}><Plus size={17} /> 공지 등록</Button>} />
      {data.announcements.length ? data.announcements.map((a) => (
        <article className="panel notice-article" key={a.id}>
          <div className="between"><div className="qa-meta">{a.pinned ? <Pill tone="info"><Pin size={11} /> 고정</Pill> : null}<Pill>{a.cohort_name ? a.cohort_name + ' 공지' : '전체 공지'}</Pill></div><small>{fmtShort(a.created)}</small></div>
          <h2>{a.title}</h2>
          <p className="clamp">{a.body}</p>
          <div className="admin-actions">
            <Button small secondary onClick={() => openModal('announcement', { ...a, cohortId: a.cohort_id || '' })}><PenLine size={14} /> 편집</Button>
            <Button small secondary onClick={() => perform('announcement', { ...a, cohortId: a.cohort_id || '', pinned: a.pinned ? 0 : 1 }, a.pinned ? '고정을 해제했습니다.' : '상단에 고정했습니다.')}><Pin size={14} /> {a.pinned ? '고정 해제' : '고정'}</Button>
            <Button small secondary danger onClick={async () => { if (await ask('공지를 삭제할까요?', undefined, { danger: true, confirmLabel: '삭제' })) perform('announcement_delete', { id: a.id }, '공지를 삭제했습니다.'); }}><Trash2 size={14} /></Button>
          </div>
        </article>
      )) : <Empty title="등록된 공지가 없어요" description="교육 일정, 기수 안내, 운영 소식을 공지로 전달하세요." icon={Megaphone} />}
    </>
  );
}

export function AdminAssignments() {
  const { data, courses, lessons, openModal, perform, ask } = useEdu();
  const [tab, setTab] = useState<'submitted' | 'all' | 'manage'>('submitted');
  if (!data) return null;
  const subs = data.submissions ?? [];
  const shown = tab === 'submitted' ? subs.filter((s) => s.status === 'submitted') : subs;
  const tone = { submitted: 'warn', passed: 'good', revise: 'bad' } as const;
  const label = { submitted: '검토 대기', passed: '통과', revise: '보완 요청' };
  return (
    <>
      <PageHead title="과제 관리" sub="과정별 실습 과제를 등록하고 교육생의 제출물을 검토하세요." action={<Button small onClick={() => openModal('assignment', { title: '', description: '', courseId: courses[0]?.id, lessonId: '', due: '', position: data.assignments.length + 1, published: 1 })}><Plus size={17} /> 과제 등록</Button>} />
      <Tabs items={[['submitted', `검토 대기 (${subs.filter((s) => s.status === 'submitted').length})`], ['all', `전체 제출물 (${subs.length})`], ['manage', `과제 목록 (${data.assignments.length})`]]} value={tab} onChange={setTab} />
      {tab === 'manage' ? (
        data.assignments.length ? data.assignments.map((a) => (
          <div className="panel assignment-card" key={a.id}>
            <div className="between"><div><span className="course-label">{courses.find((c) => c.id === a.course_id)?.title}{a.lesson_id ? ` · ${lessons.find((l) => l.id === a.lesson_id)?.title}` : ''}</span><h3>{a.title}</h3></div><div className="qa-meta"><Pill tone={a.published ? 'good' : ''}>{a.published ? '공개' : '비공개'}</Pill>{a.due && <Pill>마감 {fmtShort(a.due)}</Pill>}<Pill>제출 {subs.filter((s) => s.assignment_id === a.id).length}</Pill></div></div>
            <p className="note-text clamp">{a.description}</p>
            <div className="admin-actions">
              <Button small secondary onClick={() => openModal('assignment', { ...a, courseId: a.course_id, lessonId: a.lesson_id || '' })}><PenLine size={14} /> 편집</Button>
              <Button small secondary onClick={() => perform('assignment', { ...a, courseId: a.course_id, lessonId: a.lesson_id || '', published: a.published ? 0 : 1 }, '공개 설정을 변경했습니다.')}>{a.published ? <><EyeOff size={14} /> 비공개</> : <><Eye size={14} /> 공개</>}</Button>
              <Button small secondary danger onClick={async () => { if (await ask('과제를 삭제할까요?', '제출물도 함께 삭제됩니다.', { danger: true, confirmLabel: '삭제' })) perform('assignment_delete', { id: a.id }, '과제를 삭제했습니다.'); }}><Trash2 size={14} /></Button>
            </div>
          </div>
        )) : <Empty title="등록된 과제가 없어요" description="과정에 실습 과제를 추가해 배운 내용을 적용하게 하세요." icon={ClipboardList} />
      ) : shown.length ? shown.map((s) => {
        const a = data.assignments.find((x) => x.id === s.assignment_id);
        return (
          <div className="panel assignment-card" key={s.id}>
            <div className="between"><div><span className="course-label">{a?.title}</span><h3>{s.name} <small className="muted">{s.email}</small></h3></div><div className="qa-meta"><Pill tone={tone[s.status]}>{label[s.status]}{s.score != null ? ` · ${s.score}점` : ''}</Pill><small>{relTime(s.created)}</small></div></div>
            {s.body && <p className="note-text">{s.body}</p>}
            {s.link && <a href={s.link} target="_blank" rel="noopener noreferrer" className="text-link"><ExternalLink size={14} /> {s.link}</a>}
            {s.feedback && <div className="reply"><b>내 피드백</b><p>{s.feedback}</p></div>}
            <div className="admin-actions"><Button small onClick={() => openModal('review_submission', { id: s.id, status: s.status === 'submitted' ? 'passed' : s.status, feedback: s.feedback, score: s.score ?? '' })}><CheckCircle2 size={14} /> 검토하기</Button></div>
          </div>
        );
      }) : <Empty title={tab === 'submitted' ? '검토할 제출물이 없어요' : '제출물이 없어요'} icon={ClipboardList} />}
    </>
  );
}

export function AdminAi() {
  const { data, act, busy, setToast, go, openModal, courses } = useEdu();
  const [topic, setTopic] = useState('');
  const [mode, setMode] = useState<'draft' | 'quiz' | 'chapters' | 'summary'>('draft');
  const [text, setText] = useState('');
  const [json, setJson] = useState<any>(null);
  if (!data) return null;
  const modes: [typeof mode, string][] = [['draft', '대본·학습목표·퀴즈 초안'], ['quiz', '확인 문제 JSON'], ['chapters', '챕터 나누기'], ['summary', '소개·학습 목표']];
  return (
    <>
      <PageHead title="AI 제작 스튜디오" sub="교육 주제로 영상 대본, 확인 문제, 챕터 초안을 만들어 강의 등록에 바로 활용하세요." />
      <div className="ai-layout">
        <div className="panel">
          <span className="ai-badge"><Sparkles size={19} /> 교육 콘텐츠 어시스턴트</span>
          <h2>무엇을 만들까요?</h2>
          <Tabs items={modes} value={mode} onChange={setMode} />
          <label>{mode === 'chapters' || mode === 'quiz' ? '강의 대본 또는 내용' : '교육 주제'}<textarea rows={8} value={topic} onChange={(e) => setTopic(e.target.value)} placeholder={mode === 'draft' ? '예: 첫 라이브 방송을 준비하는 신규 셀러에게 30초 오프닝을 구성하는 방법을 알려주세요.' : '강의 내용이나 대본을 붙여 넣으세요.'} /></label>
          <div className="info-note">{data.hasAiKey ? 'AI가 연결되어 있습니다. 생성할 때 연결된 계정의 API 사용료가 발생합니다.' : 'AI가 아직 연결되지 않았습니다. 연동 설정에서 API 키를 등록해 주세요.'}</div>
          <div className="between">
            <Button disabled={busy || !topic.trim() || !data.hasAiKey} onClick={async () => { try { const r = await act('ai', { topic, mode }); setText(r.text); setJson(r.json ?? null); } catch (e: any) { setToast(e.message); } }}><Sparkles size={17} />{busy ? '만드는 중…' : '초안 생성'}</Button>
            <button className="text-link" onClick={() => go('/admin/settings')}>AI 연결 설정</button>
          </div>
        </div>
        <div className="panel ai-output">
          <span className="eyebrow">생성 결과</span>
          <h2>{modes.find((m) => m[0] === mode)?.[1]}</h2>
          {text ? (
            <>
              <textarea rows={18} value={text} onChange={(e) => setText(e.target.value)} />
              <div className="admin-actions">
                <Button secondary small onClick={() => navigator.clipboard.writeText(text).then(() => setToast('복사했습니다.')).catch(() => setToast('직접 선택해 복사해 주세요.'))}><Copy size={14} /> 복사</Button>
                {mode === 'quiz' && json && <Button small onClick={() => openModal('lesson', { course_id: courses[0]?.id, title: topic.slice(0, 40), summary: '', duration: 600, position: 1, video: '', section: '', objectives: '', transcript: '', preview: 0, chapters: '[]', questions: JSON.stringify(json, null, 2), resource: '' })}><Video size={14} /> 이 문제로 강의 만들기</Button>}
                {mode === 'chapters' && json && <Button small onClick={() => openModal('lesson', { course_id: courses[0]?.id, title: '', summary: '', duration: Math.max(600, ...json.map((c: any) => c.at + 60)), position: 1, video: '', section: '', objectives: '', transcript: topic, preview: 0, chapters: JSON.stringify(json, null, 2), questions: JSON.stringify([{ question: '', options: ['', ''], answer: 0, explanation: '' }], null, 2), resource: '' })}><Video size={14} /> 이 챕터로 강의 만들기</Button>}
              </div>
            </>
          ) : <Empty title="첫 교육 아이디어를 적어보세요" description="생성된 초안은 편집 후 강의 등록 화면으로 바로 보낼 수 있어요." icon={Sparkles} />}
        </div>
      </div>
    </>
  );
}

export function AdminSettings() {
  const { data, perform, busy, setToast } = useEdu();
  if (!data) return null;
  const s = data.adminSettings ?? {};
  const origin = typeof location !== 'undefined' ? location.origin : '';
  const copy = (t: string) => navigator.clipboard?.writeText(t).then(() => setToast('복사했습니다.'));
  return (
    <>
      <PageHead title="서비스 연동 설정" sub="수료 기준, 가입 정책, 소셜 로그인, AI와 메일 발송을 설정하세요." />
      <form className="settings-grid" onSubmit={(e) => { e.preventDefault(); const f = Object.fromEntries(new FormData(e.currentTarget)); for (const k of ['auto_approve', 'oauth_auto_approve']) f[k] = f[k] ? '1' : '0'; perform('settings', f, '설정을 저장했습니다.'); }}>
        <div className="panel">
          <h3><Settings2 size={22} /> 학습·수료 기준</h3>
          <div className="form-two">
            <label>퀴즈 통과 점수<input name="pass_score" type="number" min={1} max={100} defaultValue={s.pass_score || 80} /></label>
            <label>퀴즈 응시 가능 시청 비율(%)<input name="watch_ratio" type="number" min={10} max={100} defaultValue={s.watch_ratio || 90} /></label>
          </div>
          <label>수료증 서명 문구<input name="cert_signer" defaultValue={s.cert_signer || ''} placeholder="셀러브릭스 에듀 운영팀" /></label>
          <label>영상 업로드 용량 한도(MB)<input name="max_video_mb" type="number" min={5} max={200} defaultValue={s.max_video_mb || 50} /></label>
          <p className="small-muted">변경한 기준은 이후 학습부터 적용되며 이미 완료된 강의는 유지됩니다.</p>
        </div>
        <div className="panel">
          <h3><Lock size={22} /> 가입·로그인 정책</h3>
          <label className="check-label"><input type="checkbox" name="auto_approve" defaultChecked={s.auto_approve === '1'} /><span>이메일 가입 즉시 승인 (끄면 관리자 승인 후 학습 가능)</span></label>
          <label className="check-label"><input type="checkbox" name="oauth_auto_approve" defaultChecked={s.oauth_auto_approve === '1'} /><span>카카오·네이버 가입 즉시 승인</span></label>
          <h4>카카오 로그인 {data.oauth.kakao ? <Pill tone="good">연결됨</Pill> : <Pill>미연결</Pill>}</h4>
          <label>REST API 키<input name="kakao_client" defaultValue={s.kakao_client || ''} placeholder="카카오 개발자 콘솔 › 앱 키 › REST API 키" /></label>
          <label>Client Secret<input name="kakao_secret" type="password" autoComplete="off" placeholder={data.oauth.kakao ? '저장됨 · 변경 시에만 입력' : '카카오 로그인 › 보안 › Client Secret'} /></label>
          <p className="small-muted">Redirect URI: <code>{origin}/api/auth/kakao/callback</code> <button type="button" className="text-link" onClick={() => copy(`${origin}/api/auth/kakao/callback`)}><Copy size={12} /></button> · 동의 항목: 닉네임, 이메일</p>
          <h4>네이버 로그인 {data.oauth.naver ? <Pill tone="good">연결됨</Pill> : <Pill>미연결</Pill>}</h4>
          <label>Client ID<input name="naver_client" defaultValue={s.naver_client || ''} /></label>
          <label>Client Secret<input name="naver_secret" type="password" autoComplete="off" placeholder={data.oauth.naver ? '저장됨 · 변경 시에만 입력' : '네이버 개발자센터 › 애플리케이션'} /></label>
          <p className="small-muted">Callback URL: <code>{origin}/api/auth/naver/callback</code> <button type="button" className="text-link" onClick={() => copy(`${origin}/api/auth/naver/callback`)}><Copy size={12} /></button> · 제공 정보: 이메일, 이름/별명</p>
        </div>
        <div className="panel">
          <h3><Sparkles size={22} /> AI 콘텐츠 제작</h3>
          <p className="muted">API 키는 저장 후 다시 표시되지 않습니다.</p>
          <label>OpenAI API 키<input name="ai_key" type="password" autoComplete="off" placeholder={data.hasAiKey ? '저장된 키가 있습니다. 변경할 때만 입력하세요.' : 'sk-…'} /></label>
          <label>텍스트 생성 모델<input name="ai_model" defaultValue={s.ai_model || 'gpt-4.1-mini'} /></label>
          {data.hasAiKey && <label className="check-label"><input type="checkbox" name="clear_ai_key" /><span>저장된 API 키 삭제</span></label>}
          <label>영상 제작 서비스 메모<input name="video_provider" defaultValue={s.video_provider || ''} placeholder="추후 연결할 영상 제작 서비스" /></label>
        </div>
        <div className="panel">
          <h3><Mail size={22} /> 메일 발송 (비밀번호 재설정)</h3>
          <p className="muted">Resend API 키와 발신 주소를 등록하면 비밀번호 재설정 메일이 자동 발송됩니다. 없으면 관리자가 교육생 관리에서 링크를 전달합니다.</p>
          <label>Resend API 키<input name="resend_key" type="password" autoComplete="off" placeholder={s.resend_key === undefined ? 're_…' : '변경 시에만 입력'} /></label>
          <label>발신 주소<input name="mail_from" defaultValue={s.mail_from || ''} placeholder="셀러브릭스 에듀 <edu@yourdomain.com>" /></label>
          <div className="info-note"><KeyRound size={15} /> 수료증 공개 확인 주소: <code>{origin}/verify</code></div>
        </div>
        <button className="button" disabled={busy} type="submit">설정 저장</button>
      </form>
      <ContentTransfer />
    </>
  );
}
