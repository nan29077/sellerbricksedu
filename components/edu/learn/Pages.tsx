'use client';
import { useMemo, useState } from 'react';
import { Play, Download, Trophy, Award, Flame, Clock, CheckCircle2, ThumbsUp, Trash2, Pin, Search, ClipboardList, Link2, Send, ExternalLink, Share2 } from 'lucide-react';
import { useEdu } from '../../../lib/edu-store';
import { fmt, fmtDate, fmtLong, fmtShort, relTime, streak, thisWeek, badges, downloadText } from '../../../lib/learning';
import { Button, CharacterAvatar, Empty, Logo, PageHead, Pill, Tabs } from '../ui';
import { Heatmap } from './Dashboard';

export function SavedPage({ kind }: { kind: 'bookmarks' | 'notes' }) {
  const { lessons, courses, pfor, go, data } = useEdu();
  const isNotes = kind === 'notes';
  const tnotes = data?.notes ?? [];
  const saved = lessons.filter((l) => (isNotes ? pfor(l.id).note || tnotes.some((n) => n.lesson_id === l.id) : pfor(l.id).bookmark));
  return (
    <>
      <PageHead title={isNotes ? '나의 학습 노트' : '나의 책갈피'} sub={isNotes ? '학습하며 기록한 아이디어를 모아보세요.' : '다시 보고 싶은 강의를 빠르게 찾아보세요.'}
        action={isNotes && saved.length ? <Button small secondary onClick={() => downloadText('셀러브릭스-학습노트.md', saved.map((l) => `# ${l.title}\n\n${pfor(l.id).note || ''}\n${tnotes.filter((n) => n.lesson_id === l.id).map((n) => `- [${fmt(n.at)}] ${n.body}`).join('\n')}`).join('\n\n'))}><Download size={15} /> 전체 내려받기</Button> : undefined} />
      {saved.length ? (
        <div className="saved-grid">
          {saved.map((l) => (
            <div className="panel" key={l.id}>
              <span className="course-label">{courses.find((c) => c.id === l.course_id)?.title}</span>
              <h3>{l.title}</h3>
              {isNotes ? (
                <>
                  {pfor(l.id).note && <p className="note-text">{pfor(l.id).note}</p>}
                  {tnotes.filter((n) => n.lesson_id === l.id).map((n) => <p className="tnote-inline" key={n.id}><button onClick={() => go('/lesson/' + l.id)}>{fmt(n.at)}</button>{n.body}</p>)}
                </>
              ) : <p className="muted">{fmt(pfor(l.id).position || 0)}부터 이어보기 · {pfor(l.id).complete ? '완료' : `${Math.min(100, Math.round(((pfor(l.id).watched || 0) / l.duration) * 100))}% 시청`}</p>}
              <Button secondary small onClick={() => go('/lesson/' + l.id)}><Play size={15} /> 강의 열기</Button>
            </div>
          ))}
        </div>
      ) : <Empty title={isNotes ? '아직 작성한 학습 노트가 없어요' : '아직 저장한 책갈피가 없어요'} description={isNotes ? '강의 화면에서 타임스탬프 노트나 강의 노트를 작성해 보세요.' : '강의 화면의 책갈피 버튼으로 다시 볼 영상을 저장하세요.'} />}
    </>
  );
}

export function AchievementsPage() {
  const { data, progress, lessons, courses, pct } = useEdu();
  if (!data) return null;
  const st = streak(data.learningDays), week = thisWeek(data.learningDays);
  const list = badges(progress, data.learningDays, data.certificates.length, data.notes.length, data.messages.filter((m) => m.user_id === data.user?.id).length);
  const totalSeconds = data.learningDays.reduce((s, d) => s + d.seconds, 0);
  const best = Math.max(0, ...data.learningDays.map((d) => d.seconds));
  const quizAvg = (() => { const s = progress.filter((p) => p.best_score != null); return s.length ? Math.round(s.reduce((a, p) => a + (p.best_score || 0), 0) / s.length) : 0; })();
  return (
    <>
      <PageHead title="학습 기록과 배지" sub="나의 학습 습관을 돌아보고, 꾸준함을 배지로 모아보세요." />
      <div className="stats-grid">
        <div className="stat-card"><span><Flame size={22} /></span><p>연속 학습</p><b>{st}일</b></div>
        <div className="stat-card"><span><Clock size={22} /></span><p>총 학습 시간</p><b>{fmtLong(totalSeconds)}</b><small>하루 최고 {Math.round(best / 60)}분</small></div>
        <div className="stat-card"><span><CheckCircle2 size={22} /></span><p>학습한 날</p><b>{data.learningDays.filter((d) => d.seconds >= 60 || d.completed).length}일</b><small>이번 주 {week.days}일</small></div>
        <div className="stat-card"><span><Trophy size={22} /></span><p>퀴즈 평균</p><b>{quizAvg}점</b></div>
      </div>
      <div className="panel"><h3>최근 6개월 학습 히트맵</h3><Heatmap weeks={26} /></div>
      <div className="panel">
        <h3><Award size={18} className="purple" /> 배지 {list.filter((b) => b.earned).length} / {list.length}</h3>
        <div className="badge-grid">{list.map((b) => <div key={b.id} className={'badge-card ' + (b.earned ? 'earned' : '')}><i>{b.icon}</i><b>{b.name}</b><small>{b.desc}</small>{b.earned && <Pill tone="good">획득</Pill>}</div>)}</div>
      </div>
      <div className="panel">
        <h3>과정별 진도</h3>
        {courses.map((c) => { const p = pct(c.id); const items = lessons.filter((l) => l.course_id === c.id); const w = items.reduce((s, l) => s + (progress.find((x) => x.lesson_id === l.id)?.watched || 0), 0); return <div className="course-analytics" key={c.id}><div><b>{c.title}</b><span>{p}%</span></div><div className="progress-track"><i style={{ width: p + '%' }} /></div><small>{items.filter((l) => progress.some((x) => x.lesson_id === l.id && x.complete)).length} / {items.length}강 · {fmtLong(w)} 시청</small></div>; })}
      </div>
    </>
  );
}

export function CertificatesPage() {
  const { data, user, go } = useEdu();
  if (!data || !user) return null;
  const list = data.certificates;
  const signer = data.settings.cert_signer || '셀러브릭스 에듀 운영팀';
  return (
    <>
      <PageHead title="나의 수료증" sub="모든 강의를 완료한 과정의 수료증을 확인하고 인쇄하세요. 검증 번호로 누구나 진위를 확인할 수 있어요." />
      {list.length ? list.map((c) => (
        <div className="certificate panel" key={c.id} id={'cert-' + c.id}>
          <Logo />
          <Trophy size={44} />
          <span>CERTIFICATE OF COMPLETION</span>
          <h1>교육 수료증</h1>
          <h2>{user.name}</h2>
          <p>위 교육생은 셀러브릭스 에듀의<br /><b>{c.course_title}</b> 과정을 성실히 이수하였음을 확인합니다.</p>
          <p className="cert-date">{fmtDate(c.issued)}<br /><b>{signer}</b></p>
          <small>검증 번호 · {c.id} · {typeof location !== 'undefined' ? location.origin : ''}/verify/{c.id}</small>
          <div className="cert-actions no-print">
            <Button secondary small onClick={() => { const el = document.getElementById('cert-' + c.id); el?.classList.add('printing'); document.body.dataset.print = c.id; window.print(); setTimeout(() => { el?.classList.remove('printing'); delete document.body.dataset.print; }, 500); }}><Download size={16} /> 인쇄 / PDF 저장</Button>
            <Button secondary small onClick={() => { navigator.clipboard?.writeText(`${location.origin}/verify/${c.id}`); }}><Share2 size={16} /> 검증 링크 복사</Button>
          </div>
        </div>
      )) : <Empty title="배움의 완주를 기다리고 있어요" description="과정의 모든 영상과 확인 문제를 완료하면 수료증이 자동 발급됩니다." icon={Trophy} action={<Button small secondary onClick={() => go('/learn/courses')}>나의 강의실</Button>} />}
    </>
  );
}

export function QuestionsPage() {
  const { data, user, lessons, courses, act, perform, admin, go, ask, patch } = useEdu();
  const [filter, setFilter] = useState<'all' | 'mine' | 'open' | 'answered'>(admin ? 'open' : 'mine');
  const [search, setSearch] = useState('');
  const messages = data?.messages;
  const userId = user?.id;
  const list = useMemo(() => (messages ?? []).filter((m) =>
    (filter === 'all' || (filter === 'mine' && m.user_id === userId) || (filter === 'open' && !m.reply) || (filter === 'answered' && !!m.reply)) &&
    (!search || m.body.includes(search) || (lessons.find((l) => l.id === m.lesson_id)?.title || '').includes(search) || (m.name || '').includes(search)),
  ), [messages, filter, search, userId, lessons]);
  if (!data || !user) return null;
  return (
    <>
      <PageHead title={admin ? '교육생 질문 관리' : '학습 Q&A'} sub={admin ? '학습 중 궁금한 점에 답변하고 교육생의 성장을 도와주세요.' : '강의에 남긴 질문과 다른 교육생의 공개 질문을 확인하세요.'} />
      <div className="filter-row">
        <Tabs items={admin ? [['open', `답변 대기 (${data.messages.filter((m) => !m.reply).length})`], ['answered', '답변 완료'], ['all', '전체']] : [['mine', '내 질문'], ['all', '전체 공개 질문'], ['open', '답변 대기'], ['answered', '답변 완료']]} value={filter} onChange={setFilter} />
        <div className="search"><Search size={17} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="질문·강의 검색" aria-label="질문 검색" /></div>
      </div>
      {list.length ? list.map((m) => {
        const lesson = lessons.find((l) => l.id === m.lesson_id);
        return (
          <div className={'panel question-card ' + (m.pinned ? 'pinned' : '')} key={m.id}>
            <div className="between">
              <div className="qa-meta"><CharacterAvatar index={m.avatar} /><b>{m.user_id === user.id ? '나' : m.name}</b>{admin && m.email && <small>{m.email}</small>}<small>{relTime(m.created)}</small></div>
              <div className="qa-meta">{m.pinned ? <Pill tone="info"><Pin size={11} /> 추천</Pill> : null}{!m.public && <Pill>비공개</Pill>}<Pill tone={m.reply ? 'good' : 'warn'}>{m.reply ? '답변 완료' : '답변 대기'}</Pill></div>
            </div>
            <h3>{lesson ? <button className="text-link" onClick={() => go('/lesson/' + lesson.id)}>{courses.find((c) => c.id === lesson.course_id)?.title} · {lesson.title}</button> : '학습 문의'}</h3>
            <p className="note-text">{m.body}</p>
            {m.reply && <div className="reply"><b>에듀 관리자 답변</b><p>{m.reply}</p></div>}
            <div className="qa-actions">
              <button className={m.voted ? 'on' : ''} onClick={() => { patch((d) => ({ ...d, messages: d.messages.map((x) => x.id === m.id ? { ...x, voted: x.voted ? 0 : 1, votes: x.votes + (x.voted ? -1 : 1) } : x) })); act('vote', { id: m.id }, true); }}><ThumbsUp size={14} /> 저도 궁금해요 {m.votes > 0 && m.votes}</button>
              {admin && <>
                <Button small secondary onClick={() => perform('question_update', { id: m.id, pinned: m.pinned ? 0 : 1 }, m.pinned ? '추천을 해제했습니다.' : '추천 질문으로 고정했습니다.')}><Pin size={14} /> {m.pinned ? '추천 해제' : '추천 고정'}</Button>
                <Button small secondary onClick={() => perform('question_update', { id: m.id, public: m.public ? 0 : 1 }, '공개 설정을 변경했습니다.')}>{m.public ? '비공개로' : '공개로'}</Button>
              </>}
              {(m.user_id === user.id && !m.reply) || admin ? <button onClick={async () => { if (await ask('질문을 삭제할까요?', '삭제한 질문은 복구할 수 없습니다.', { danger: true, confirmLabel: '삭제' })) perform('question_delete', { id: m.id }, '질문을 삭제했습니다.'); }}><Trash2 size={14} /> 삭제</button> : null}
            </div>
            {admin && <AdminReplyButton id={m.id} reply={m.reply} />}
          </div>
        );
      }) : <Empty title="질문이 없어요" description={admin ? '모든 질문에 답변했어요.' : '강의 화면에서 질문을 남기면 이곳에서 확인할 수 있습니다.'} />}
    </>
  );
}
function AdminReplyButton({ id, reply }: { id: string; reply: string }) {
  const { openModal } = useEdu();
  return <Button secondary small onClick={() => openModal('reply', { id, reply })}>{reply ? '답변 수정' : '답변 작성'}</Button>;
}

export function NoticesPage() {
  const { data } = useEdu();
  const [open, setOpen] = useState<string | null>(null);
  if (!data) return null;
  return (
    <>
      <PageHead title="공지사항" sub="교육 일정, 기수 안내와 운영 소식을 확인하세요." />
      {data.announcements.length ? data.announcements.map((a) => (
        <article className={'panel notice-article ' + (open === a.id ? 'open' : '')} key={a.id}>
          <div className="between"><Pill tone={a.pinned ? 'info' : ''}>{a.pinned ? <><Pin size={12} /> 고정</> : a.cohort_name ? a.cohort_name + ' 공지' : '전체 공지'}</Pill><small>{fmtShort(a.created)}</small></div>
          <h2><button onClick={() => setOpen(open === a.id ? null : a.id)}>{a.title}</button></h2>
          <p className={open === a.id ? 'full' : 'clamp'}>{a.body}</p>
        </article>
      )) : <Empty title="등록된 공지가 없어요" description="새로운 안내가 등록되면 알림으로 알려드려요." />}
    </>
  );
}

export function AssignmentsPage() {
  const { data, courses, lessons, perform, busy, go } = useEdu();
  const [draft, setDraft] = useState<{ id: string; body: string; link: string } | null>(null);
  if (!data) return null;
  const list = data.assignments;
  const sub = (id: string) => data.submissions.find((s) => s.assignment_id === id);
  const tone = { submitted: 'warn', passed: 'good', revise: 'bad' } as const;
  const label = { submitted: '검토 중', passed: '통과', revise: '보완 요청' };
  return (
    <>
      <PageHead title="실습 과제" sub="배운 내용을 과제로 정리해 제출하면 관리자가 피드백을 드려요." />
      {list.length ? list.map((a) => {
        const s = sub(a.id);
        const overdue = a.due && !s && a.due < new Date().toISOString().slice(0, 10);
        return (
          <div className="panel assignment-card" key={a.id}>
            <div className="between">
              <div><span className="course-label">{courses.find((c) => c.id === a.course_id)?.title}{a.lesson_id ? ` · ${lessons.find((l) => l.id === a.lesson_id)?.title}` : ''}</span><h3>{a.title}</h3></div>
              <div className="qa-meta">{a.due && <Pill tone={overdue ? 'bad' : ''}>{overdue ? '마감 지남' : `마감 ${fmtShort(a.due)}`}</Pill>}{s && <Pill tone={tone[s.status]}>{label[s.status]}{s.score != null ? ` · ${s.score}점` : ''}</Pill>}</div>
            </div>
            <p className="note-text">{a.description}</p>
            {s && (
              <div className="submission-box">
                <b>내 제출물 <small>{fmtShort(s.created)}</small></b>
                {s.body && <p className="note-text">{s.body}</p>}
                {s.link && <a href={s.link} target="_blank" rel="noopener noreferrer" className="text-link"><ExternalLink size={14} /> {s.link}</a>}
                {s.feedback && <div className="reply"><b>관리자 피드백</b><p>{s.feedback}</p></div>}
              </div>
            )}
            {draft?.id === a.id ? (
              <form className="submit-form" onSubmit={async (e) => { e.preventDefault(); const r = await perform('submit', { assignmentId: a.id, body: draft.body, link: draft.link }, '과제를 제출했습니다. 검토 후 알림으로 알려드려요.'); if (r) setDraft(null); }}>
                <label>과제 내용<textarea rows={5} maxLength={5000} value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} placeholder="과제 내용을 정리해 주세요. 방송 스크립트, 체크리스트, 회고 등" /></label>
                <label><Link2 size={14} /> 링크 (선택)<input type="url" value={draft.link} onChange={(e) => setDraft({ ...draft, link: e.target.value })} placeholder="https:// 영상·문서·게시물 링크" /></label>
                <div className="between"><Button small secondary onClick={() => setDraft(null)}>취소</Button><Button small type="submit" disabled={busy}><Send size={15} /> {s ? '다시 제출' : '제출하기'}</Button></div>
              </form>
            ) : (
              <div className="between">
                {a.lesson_id && <button className="text-link" onClick={() => go('/lesson/' + a.lesson_id)}>관련 강의 보기</button>}
                {(!s || s.status === 'revise') && <Button small onClick={() => setDraft({ id: a.id, body: s?.body || '', link: s?.link || '' })}><ClipboardList size={15} /> {s ? '보완하여 다시 제출' : '과제 제출'}</Button>}
              </div>
            )}
          </div>
        );
      }) : <Empty title="등록된 과제가 없어요" description="과정에 실습 과제가 등록되면 이곳에서 제출할 수 있어요." icon={ClipboardList} />}
    </>
  );
}
