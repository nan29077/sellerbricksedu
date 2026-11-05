'use client';
import { useMemo, useState } from 'react';
import { Play, Download, Trophy, Award, Flame, Clock, CheckCircle2, ThumbsUp, Trash2, Pin, Search, ClipboardList, Link2, Send, ExternalLink, Share2, Bookmark, PenLine, Plus, Eye, EyeOff, X } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { dday, ddayLabel, weeklySeries, weekdayPattern } from '../../../lib/insights';
import { useEdu } from '../../../lib/edu-store';
import { fmt, fmtDate, fmtLong, fmtShort, relTime, streak, thisWeek, badges, downloadText, addDays } from '../../../lib/learning';
import { Button, CharacterAvatar, Empty, Logo, PageHead, Pill, ProgressBar, Tabs } from '../ui';
import { Heatmap } from './Dashboard';

export function SavedPage({ kind }: { kind: 'bookmarks' | 'notes' }) {
  const { lessons, courses, pfor, go, data, perform, ask } = useEdu();
  const [q, setQ] = useState('');
  const [courseId, setCourseId] = useState('all');
  const isNotes = kind === 'notes';
  const tnotes = data?.notes ?? [];
  const query = q.trim();
  const saved = lessons.filter((l) => (isNotes ? pfor(l.id).note || tnotes.some((n) => n.lesson_id === l.id) : pfor(l.id).bookmark));
  const shown = saved.filter((l) => (courseId === 'all' || l.course_id === courseId) && (!query || l.title.includes(query) || (pfor(l.id).note || '').includes(query) || tnotes.some((n) => n.lesson_id === l.id && n.body.includes(query))));
  const usedCourses = courses.filter((c) => saved.some((l) => l.course_id === c.id));
  const groups = usedCourses.map((c) => ({ c, items: shown.filter((l) => l.course_id === c.id) })).filter((g) => g.items.length);
  const total = isNotes ? tnotes.length + saved.filter((l) => pfor(l.id).note).length : saved.length;
  return (
    <>
      <PageHead title={isNotes ? '나의 학습 노트' : '나의 책갈피'} sub={isNotes ? '학습하며 기록한 아이디어를 과정별로 모아보고, 장면으로 바로 돌아가세요.' : '다시 보고 싶은 강의를 과정별로 빠르게 찾아보세요.'}
        action={isNotes && saved.length ? <Button small secondary onClick={() => downloadText('셀러브릭스-학습노트.md', usedCourses.map((c) => `# ${c.title}\n\n` + saved.filter((l) => l.course_id === c.id).map((l) => `## ${l.title}\n\n${pfor(l.id).note || ''}\n${tnotes.filter((n) => n.lesson_id === l.id).map((n) => `- [${fmt(n.at)}] ${n.body}`).join('\n')}`).join('\n\n')).join('\n\n'))}><Download size={15} /> 전체 내려받기</Button> : undefined} />
      {saved.length > 0 && (
        <div className="filter-row">
          <select aria-label="과정 선택" value={courseId} onChange={(e) => setCourseId(e.target.value)}><option value="all">모든 과정 ({saved.length})</option>{usedCourses.map((c) => <option key={c.id} value={c.id}>{c.title} ({saved.filter((l) => l.course_id === c.id).length})</option>)}</select>
          <div className="search"><Search size={17} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder={isNotes ? '노트 내용·강의 검색' : '강의 제목 검색'} aria-label="검색" /></div>
          <span className="small-muted">{isNotes ? `노트 ${total}개` : `책갈피 ${total}개`}</span>
        </div>
      )}
      {groups.length ? groups.map(({ c, items }) => (
        <section key={c.id} className="saved-group">
          <h3 className="saved-group-title">{c.title} <small>{items.length}강</small></h3>
          <div className="saved-grid">
            {items.map((l) => {
              const p = pfor(l.id);
              const ns = tnotes.filter((n) => n.lesson_id === l.id);
              return (
                <div className="panel" key={l.id}>
                  <div className="between"><span className="course-label">{l.section || c.category}</span>{p.complete ? <Pill tone="good">완료</Pill> : null}</div>
                  <h3>{l.title}</h3>
                  {isNotes ? (
                    <>
                      {p.note && <p className="note-text">{p.note}</p>}
                      {ns.map((n) => <p className="tnote-inline" key={n.id}><button onClick={() => go('/lesson/' + l.id)}>{fmt(n.at)}</button><span>{n.body}</span><button className="icon-button" aria-label="노트 삭제" onClick={async () => { if (await ask('이 노트를 삭제할까요?', undefined, { danger: true, confirmLabel: '삭제' })) perform('tnote', { lessonId: l.id, id: n.id, remove: true }, '노트를 삭제했습니다.'); }}><Trash2 size={13} /></button></p>)}
                    </>
                  ) : (
                    <>
                      <p className="muted">{fmt(p.position || 0)}부터 이어보기 · {p.complete ? '완료' : `${Math.min(100, Math.round(((p.watched || 0) / l.duration) * 100))}% 시청`}</p>
                      <ProgressBar value={p.complete ? 100 : Math.min(100, Math.round(((p.watched || 0) / l.duration) * 100))} small />
                    </>
                  )}
                  <div className="between">
                    <Button secondary small onClick={() => go('/lesson/' + l.id)}><Play size={15} /> {isNotes ? '강의 열기' : '이어보기'}</Button>
                    {!isNotes && <button className="text-link" onClick={() => perform('bookmark', { lessonId: l.id }, '책갈피를 해제했습니다.')}><Bookmark size={13} /> 해제</button>}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )) : saved.length ? <Empty title="검색 결과가 없어요" description="다른 키워드나 과정을 선택해 주세요." icon={Search} /> : <Empty title={isNotes ? '아직 작성한 학습 노트가 없어요' : '아직 저장한 책갈피가 없어요'} description={isNotes ? '강의 화면에서 타임스탬프 노트나 강의 노트를 작성해 보세요.' : '강의 화면의 책갈피 버튼으로 다시 볼 영상을 저장하세요.'} />}
    </>
  );
}

export function AchievementsPage() {
  const { data, progress, lessons, courses, pct } = useEdu();
  if (!data) return null;
  const st = streak(data.learningDays), week = thisWeek(data.learningDays);
  const uid = data.user?.id;
  const list = badges(progress, data.learningDays, data.certificates.length, data.notes.length, data.messages.filter((m) => m.user_id === uid).length, { passed: data.submissions.filter((s) => s.status === 'passed').length, posts: data.posts.filter((p) => p.user_id === uid).length, events: data.events.filter((e) => e.mine).length });
  const totalSeconds = data.learningDays.reduce((s, d) => s + d.seconds, 0);
  const best = Math.max(0, ...data.learningDays.map((d) => d.seconds));
  const quizAvg = (() => { const s = progress.filter((p) => p.best_score != null); return s.length ? Math.round(s.reduce((a, p) => a + (p.best_score || 0), 0) / s.length) : 0; })();
  const longest = (() => { const set = new Set(data.learningDays.filter((d) => d.seconds >= 60 || d.completed > 0).map((d) => d.day)); let bestRun = 0; for (const d of set) { if (set.has(addDays(d, -1))) continue; let n = 0, cur = d; while (set.has(cur)) { n++; cur = addDays(cur, 1); } bestRun = Math.max(bestRun, n); } return bestRun; })();
  const weekly = weeklySeries(data.learningDays, 12);
  const pattern = weekdayPattern(data.learningDays);
  const topDay = [...pattern].sort((a, b) => b.minutes - a.minutes)[0];
  const attempts = data.quizAttempts ?? [];
  const firstTry = (() => { const firsts = new Map<string, number>(); [...attempts].reverse().forEach((a) => { if (!firsts.has(a.lesson_id)) firsts.set(a.lesson_id, a.passed); }); const v = Array.from(firsts.values()); return v.length ? Math.round((v.filter(Boolean).length / v.length) * 100) : 0; })();
  const earnedCount = list.filter((b) => b.earned).length;
  return (
    <>
      <PageHead title="학습 기록과 배지" sub="나의 학습 습관을 돌아보고, 꾸준함을 배지로 모아보세요." />
      <div className="stats-grid">
        <div className="stat-card"><span><Flame size={22} /></span><p>연속 학습</p><b>{st}일</b><small>최장 {longest}일</small></div>
        <div className="stat-card"><span><Clock size={22} /></span><p>총 학습 시간</p><b>{fmtLong(totalSeconds)}</b><small>하루 최고 {Math.round(best / 60)}분</small></div>
        <div className="stat-card"><span><CheckCircle2 size={22} /></span><p>학습한 날</p><b>{data.learningDays.filter((d) => d.seconds >= 60 || d.completed).length}일</b><small>이번 주 {week.days}일</small></div>
        <div className="stat-card"><span><Trophy size={22} /></span><p>퀴즈 평균</p><b>{quizAvg}점</b><small>첫 시도 통과율 {firstTry}%</small></div>
      </div>
      <div className="admin-two">
        <div className="panel chart-panel">
          <h3>최근 12주 학습 시간</h3>
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={weekly} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--line)" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--muted)' }} tickLine={false} axisLine={false} interval={1} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'var(--muted)' }} tickLine={false} axisLine={false} width={34} />
                <Tooltip cursor={{ fill: 'var(--light)' }} contentStyle={{ borderRadius: 12, border: '1px solid var(--line)', fontSize: 13 }} formatter={(v: any, n: any) => [n === 'minutes' ? `${v}분` : `${v}강`, n === 'minutes' ? '학습 시간' : '완료']} labelFormatter={(l) => `${l} 주`} />
                <Bar dataKey="minutes" fill="var(--purple)" radius={[4, 4, 0, 0]} maxBarSize={22} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="panel">
          <h3>나의 학습 요일</h3>
          <p className="muted">{topDay.minutes ? `최근 12주 동안 ${topDay.name}요일에 가장 많이 학습했어요. 그 요일을 '학습의 날'로 정해 보세요.` : '학습 기록이 쌓이면 요일별 패턴을 보여드려요.'}</p>
          <div className="dow-bars">{pattern.map((d) => <div key={d.name}><span>{d.name}</span><div className="progress-track"><i style={{ width: `${topDay.minutes ? Math.round((d.minutes / topDay.minutes) * 100) : 0}%` }} /></div><small>{d.minutes}분</small></div>)}</div>
        </div>
      </div>
      <div className="panel"><h3>최근 6개월 학습 히트맵</h3><Heatmap weeks={26} /></div>
      <div className="panel">
        <h3><Award size={18} className="purple" /> 배지 {earnedCount} / {list.length}</h3>
        <ProgressBar value={Math.round((earnedCount / list.length) * 100)} small />
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
  const { data, user, go, courses, ls, pct, pfor, setToast } = useEdu();
  if (!data || !user) return null;
  const list = data.certificates;
  const near = courses.filter((c) => !list.some((x) => x.course_id === c.id) && pct(c.id) > 0).map((c) => ({ c, left: ls(c.id).filter((l) => !pfor(l.id).complete) })).sort((a, b) => a.left.length - b.left.length).slice(0, 4);
  const signer = data.settings.cert_signer || '셀러브릭스 캠퍼스 운영팀';
  return (
    <>
      <PageHead title="나의 수료증" sub="모든 강의를 완료한 과정의 수료증을 확인하고 인쇄하세요. 검증 번호로 누구나 진위를 확인할 수 있어요." />
      {near.length > 0 && (
        <div className="panel no-print">
          <h3><Trophy size={18} className="purple" /> 수료까지 얼마 남지 않았어요</h3>
          {near.map(({ c, left }) => <div className="course-analytics" key={c.id}><div><b>{c.title}</b><span>{left.length}강 남음</span></div><div className="progress-track"><i style={{ width: pct(c.id) + '%' }} /></div><small>{pct(c.id)}% 완료 · 남은 학습 {fmtLong(left.reduce((s, l) => s + l.duration, 0))}{left[0] && <> · <button className="text-link" onClick={() => go('/lesson/' + left[0].id)}>다음: {left[0].title}</button></>}</small></div>)}
        </div>
      )}
      {list.length ? list.map((c) => (
        <div className="certificate panel" key={c.id} id={'cert-' + c.id}>
          <Logo />
          <Trophy size={44} />
          <span>CERTIFICATE OF COMPLETION</span>
          <h1>교육 수료증</h1>
          <h2>{user.name}</h2>
          <p>위 교육생은 셀러브릭스 캠퍼스의<br /><b>{c.course_title}</b> 과정을 성실히 이수하였음을 확인합니다.</p>
          <p className="cert-date">{fmtDate(c.issued)}<br /><b>{signer}</b></p>
          <small>검증 번호 · {c.id} · {typeof location !== 'undefined' ? location.origin : ''}/verify/{c.id}</small>
          <div className="cert-actions no-print">
            <Button secondary small onClick={() => { const el = document.getElementById('cert-' + c.id); el?.classList.add('printing'); document.body.dataset.print = c.id; window.print(); setTimeout(() => { el?.classList.remove('printing'); delete document.body.dataset.print; }, 500); }}><Download size={16} /> 인쇄 / PDF 저장</Button>
            <Button secondary small onClick={() => { navigator.clipboard?.writeText(`${location.origin}/verify/${c.id}`).then(() => setToast('검증 링크를 복사했습니다. 이력서나 SNS에 붙여 넣어 보세요.'), () => setToast('복사하지 못했습니다. 주소를 직접 선택해 주세요.', 'error')); }}><Share2 size={16} /> 검증 링크 복사</Button>
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
  const [compose, setCompose] = useState<{ lessonId: string; body: string; isPublic: boolean } | null>(null);
  const [editing, setEditing] = useState<{ id: string; body: string; isPublic: boolean } | null>(null);
  const messages = data?.messages;
  const userId = user?.id;
  const list = useMemo(() => (messages ?? []).filter((m) =>
    (filter === 'all' || (filter === 'mine' && m.user_id === userId) || (filter === 'open' && !m.reply) || (filter === 'answered' && !!m.reply)) &&
    (!search || m.body.includes(search) || (lessons.find((l) => l.id === m.lesson_id)?.title || '').includes(search) || (m.name || '').includes(search)),
  ), [messages, filter, search, userId, lessons]);
  if (!data || !user) return null;
  return (
    <>
      <PageHead title={admin ? '교육생 질문 관리' : '학습 Q&A'} sub={admin ? '학습 중 궁금한 점에 답변하고 교육생의 성장을 도와주세요.' : '강의에 남긴 질문과 다른 교육생의 공개 질문을 확인하세요.'} action={!admin && !compose ? <Button small onClick={() => setCompose({ lessonId: '', body: '', isPublic: true })}><Plus size={15} /> 질문하기</Button> : undefined} />
      {admin && (() => { const answered = data.messages.filter((m) => m.reply && m.replied); const avgH = answered.length ? answered.reduce((s, m) => s + (new Date(m.replied!).getTime() - new Date(m.created).getTime()), 0) / answered.length / 3600000 : 0; const oldest = data.messages.filter((m) => !m.reply).sort((a, b) => a.created.localeCompare(b.created))[0]; return (
        <div className="stats-grid compact">
          <div className="stat-card mini warn"><p>답변 대기</p><b>{data.messages.filter((m) => !m.reply).length}건</b></div>
          <div className="stat-card mini"><p>가장 오래 기다린 질문</p><b>{oldest ? relTime(oldest.created) : '-'}</b></div>
          <div className="stat-card mini"><p>평균 답변 시간</p><b>{answered.length ? (avgH < 1 ? `${Math.max(1, Math.round(avgH * 60))}분` : avgH < 48 ? `${Math.round(avgH)}시간` : `${Math.round(avgH / 24)}일`) : '-'}</b></div>
          <div className="stat-card mini"><p>공감 많은 질문</p><b>{data.messages.filter((m) => m.votes >= 2).length}건</b></div>
        </div>
      ); })()}
      {compose && (
        <form className="panel compose-question" onSubmit={async (e) => { e.preventDefault(); const r = await perform('question', { lessonId: compose.lessonId || undefined, body: compose.body, isPublic: compose.isPublic }, '질문을 남겼습니다. 답변이 오면 알림으로 알려드려요.'); if (r) { setCompose(null); setFilter('mine'); } }}>
          <div className="between"><h3>새 질문</h3><button type="button" className="icon-button" aria-label="닫기" onClick={() => setCompose(null)}><X size={16} /></button></div>
          <label>관련 강의 (선택)<select value={compose.lessonId} onChange={(e) => setCompose({ ...compose, lessonId: e.target.value })}><option value="">일반 학습 문의</option>{courses.map((c) => <optgroup key={c.id} label={c.title}>{lessons.filter((l) => l.course_id === c.id).map((l) => <option key={l.id} value={l.id}>{l.title}</option>)}</optgroup>)}</select></label>
          <label>질문 내용<textarea rows={4} maxLength={5000} required value={compose.body} onChange={(e) => setCompose({ ...compose, body: e.target.value })} placeholder="상황(상품·방송 플랫폼·막힌 지점)을 함께 적어주시면 더 정확하게 답변드릴 수 있어요." /></label>
          <div className="between"><label className="check-label inline"><input type="checkbox" checked={compose.isPublic} onChange={(e) => setCompose({ ...compose, isPublic: e.target.checked })} /><span>{compose.isPublic ? <><Eye size={14} /> 다른 교육생에게 공개</> : <><EyeOff size={14} /> 관리자만 보기</>}</span></label><Button small type="submit" disabled={!compose.body.trim()}><Send size={14} /> 질문 등록</Button></div>
        </form>
      )}
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
            {editing?.id === m.id ? (
              <form className="edit-question" onSubmit={async (e) => { e.preventDefault(); const r = await perform('question_edit', { id: m.id, body: editing.body, isPublic: editing.isPublic }, '질문을 수정했습니다.'); if (r) setEditing(null); }}>
                <textarea rows={4} maxLength={5000} value={editing.body} onChange={(e) => setEditing({ ...editing, body: e.target.value })} />
                <div className="between"><label className="check-label inline"><input type="checkbox" checked={editing.isPublic} onChange={(e) => setEditing({ ...editing, isPublic: e.target.checked })} /><span>공개 질문</span></label><div className="qa-meta"><Button small secondary onClick={() => setEditing(null)}>취소</Button><Button small type="submit" disabled={!editing.body.trim()}>저장</Button></div></div>
              </form>
            ) : <p className="note-text">{m.body}{m.edited ? <small className="muted"> (수정됨)</small> : null}</p>}
            {m.reply && <div className="reply"><b>캠퍼스 관리자 답변</b><p>{m.reply}</p></div>}
            <div className="qa-actions">
              <button className={m.voted ? 'on' : ''} onClick={() => { patch((d) => ({ ...d, messages: d.messages.map((x) => x.id === m.id ? { ...x, voted: x.voted ? 0 : 1, votes: x.votes + (x.voted ? -1 : 1) } : x) })); act('vote', { id: m.id }, true); }}><ThumbsUp size={14} /> 저도 궁금해요 {m.votes > 0 && m.votes}</button>
              {admin && <>
                <Button small secondary onClick={() => perform('question_update', { id: m.id, pinned: m.pinned ? 0 : 1 }, m.pinned ? '추천을 해제했습니다.' : '추천 질문으로 고정했습니다.')}><Pin size={14} /> {m.pinned ? '추천 해제' : '추천 고정'}</Button>
                <Button small secondary onClick={() => perform('question_update', { id: m.id, public: m.public ? 0 : 1 }, '공개 설정을 변경했습니다.')}>{m.public ? '비공개로' : '공개로'}</Button>
              </>}
              {m.user_id === user.id && !m.reply && editing?.id !== m.id && <button onClick={() => setEditing({ id: m.id, body: m.body, isPublic: !!m.public })}><PenLine size={14} /> 수정</button>}
              {(m.user_id === user.id && !m.reply) || admin ? <button onClick={async () => { if (await ask('질문을 삭제할까요?', '삭제한 질문은 복구할 수 없습니다.', { danger: true, confirmLabel: '삭제' })) perform('question_delete', { id: m.id }, '질문을 삭제했습니다.'); }}><Trash2 size={14} /> 삭제</button> : null}
            </div>
            {admin && <AdminReplyButton id={m.id} reply={m.reply} question={m.body} asker={m.name} />}
          </div>
        );
      }) : <Empty title="질문이 없어요" description={admin ? '모든 질문에 답변했어요.' : '강의 화면에서 질문을 남기면 이곳에서 확인할 수 있습니다.'} />}
    </>
  );
}
function AdminReplyButton({ id, reply, question, asker }: { id: string; reply: string; question: string; asker: string }) {
  const { openModal } = useEdu();
  return <Button secondary small onClick={() => openModal('reply', { id, reply, question, asker })}>{reply ? '답변 수정' : '답변 작성'}</Button>;
}

export function NoticesPage() {
  const { data, act, patch } = useEdu();
  const [open, setOpen] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [onlyUnread, setOnlyUnread] = useState(false);
  if (!data) return null;
  const unread = data.announcements.filter((a) => !a.read).length;
  const markRead = (id: string) => { patch((d) => ({ ...d, announcements: d.announcements.map((x) => x.id === id ? { ...x, read: 1 } : x) })); act('notice_read', { id }, true); };
  const list = data.announcements.filter((a) => (!onlyUnread || !a.read) && (!q.trim() || a.title.includes(q.trim()) || a.body.includes(q.trim())));
  return (
    <>
      <PageHead title="공지사항" sub="교육 일정, 기수 안내와 운영 소식을 확인하세요." action={unread > 0 ? <Button small secondary onClick={() => { patch((d) => ({ ...d, announcements: d.announcements.map((x) => ({ ...x, read: 1 })) })); act('notice_read', { all: true }, true); }}><CheckCircle2 size={15} /> 모두 읽음 ({unread})</Button> : undefined} />
      <div className="filter-row">
        <label className="check-label inline"><input type="checkbox" checked={onlyUnread} onChange={(e) => setOnlyUnread(e.target.checked)} /><span>안 읽은 공지만 ({unread})</span></label>
        <div className="search"><Search size={17} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="공지 검색" aria-label="공지 검색" /></div>
      </div>
      {list.length ? list.map((a) => (
        <article className={'panel notice-article ' + (open === a.id ? 'open' : '') + (a.read ? '' : ' unread')} key={a.id}>
          <div className="between"><div className="qa-meta">{!a.read && <Pill tone="warn">NEW</Pill>}<Pill tone={a.pinned ? 'info' : ''}>{a.pinned ? <><Pin size={12} /> 고정</> : a.cohort_name ? a.cohort_name + ' 공지' : '전체 공지'}</Pill>{a.pinned && a.cohort_name ? <Pill>{a.cohort_name}</Pill> : null}</div><small>{fmtShort(a.created)}</small></div>
          <h2><button aria-expanded={open === a.id} onClick={() => { const next = open === a.id ? null : a.id; setOpen(next); if (next && !a.read) markRead(a.id); }}>{a.title}</button></h2>
          <p className={open === a.id ? 'full' : 'clamp'}>{a.body}</p>
          {open !== a.id && a.body.length > 120 && <button className="text-link" onClick={() => { setOpen(a.id); if (!a.read) markRead(a.id); }}>더 보기</button>}
        </article>
      )) : <Empty title={q || onlyUnread ? '조건에 맞는 공지가 없어요' : '등록된 공지가 없어요'} description="새로운 안내가 등록되면 알림으로 알려드려요." />}
    </>
  );
}

export function AssignmentsPage() {
  const { data, courses, lessons, perform, busy, go } = useEdu();
  const [draft, setDraft] = useState<{ id: string; body: string; link: string } | null>(null);
  const [tab, setTab] = useState<'all' | 'todo' | 'submitted' | 'revise' | 'passed'>('all');
  if (!data) return null;
  const sub = (id: string) => data.submissions.find((s) => s.assignment_id === id);
  const stateOf = (id: string) => sub(id)?.status || 'todo';
  const count = (k: string) => data.assignments.filter((a) => stateOf(a.id) === k).length;
  const list = data.assignments.filter((a) => tab === 'all' || stateOf(a.id) === tab).sort((a, b) => { const order = { revise: 0, todo: 1, submitted: 2, passed: 3 } as Record<string, number>; return order[stateOf(a.id)] - order[stateOf(b.id)] || (a.due || '9999').localeCompare(b.due || '9999'); });
  const tone = { submitted: 'warn', passed: 'good', revise: 'bad' } as const;
  const label = { submitted: '검토 중', passed: '통과', revise: '보완 요청' };
  const total = data.assignments.length, passed = count('passed');
  const scored = data.submissions.filter((s) => s.score != null);
  return (
    <>
      <PageHead title="실습 과제" sub="배운 내용을 과제로 정리해 제출하면 관리자가 피드백을 드려요." />
      {total > 0 && (
        <div className="stats-grid compact">
          <StatMini label="통과" value={`${passed} / ${total}`} />
          <StatMini label="미제출" value={count('todo') + '개'} warn={count('todo') > 0} />
          <StatMini label="보완 요청" value={count('revise') + '개'} warn={count('revise') > 0} />
          <StatMini label="평균 점수" value={scored.length ? Math.round(scored.reduce((s, x) => s + (x.score || 0), 0) / scored.length) + '점' : '-'} />
        </div>
      )}
      <Tabs items={[['all', `전체 (${total})`], ['todo', `미제출 (${count('todo')})`], ['revise', `보완 요청 (${count('revise')})`], ['submitted', `검토 중 (${count('submitted')})`], ['passed', `통과 (${passed})`]]} value={tab} onChange={setTab} />
      {list.length ? list.map((a) => {
        const s = sub(a.id);
        const dd = dday(a.due);
        const overdue = !s && dd != null && dd < 0;
        return (
          <div className={'panel assignment-card' + (s?.status === 'revise' ? ' needs-fix' : '')} key={a.id}>
            <div className="between">
              <div><span className="course-label">{courses.find((c) => c.id === a.course_id)?.title}{a.lesson_id ? ` · ${lessons.find((l) => l.id === a.lesson_id)?.title}` : ''}</span><h3>{a.title}</h3></div>
              <div className="qa-meta">{a.due && <Pill tone={overdue ? 'bad' : !s && dd != null && dd <= 2 ? 'warn' : ''}>{overdue ? '마감 지남' : `마감 ${fmtShort(a.due)} · ${ddayLabel(dd)}`}</Pill>}{s && <Pill tone={tone[s.status]}>{label[s.status]}{s.score != null ? ` · ${s.score}점` : ''}</Pill>}</div>
            </div>
            <p className="note-text">{a.description}</p>
            {s && (
              <div className="submission-box">
                <b>내 제출물 <small>{fmtShort(s.created)}{s.reviewed ? ` · 검토 ${fmtShort(s.reviewed)}` : ''}</small></b>
                {s.body && <p className="note-text">{s.body}</p>}
                {s.link && <a href={s.link} target="_blank" rel="noopener noreferrer" className="text-link"><ExternalLink size={14} /> {s.link}</a>}
                {s.feedback && <div className="reply"><b>관리자 피드백</b><p>{s.feedback}</p></div>}
              </div>
            )}
            {draft?.id === a.id ? (
              <form className="submit-form" onSubmit={async (e) => { e.preventDefault(); const r = await perform('submit', { assignmentId: a.id, body: draft.body, link: draft.link }, '과제를 제출했습니다. 검토 후 알림으로 알려드려요.'); if (r) setDraft(null); }}>
                <label>과제 내용<textarea rows={6} maxLength={5000} value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} placeholder="과제 내용을 정리해 주세요. 방송 스크립트, 체크리스트, 회고 등" /><small className="char-count">{draft.body.length.toLocaleString()} / 5,000자</small></label>
                <label><Link2 size={14} /> 링크 (선택)<input type="url" value={draft.link} onChange={(e) => setDraft({ ...draft, link: e.target.value })} placeholder="https:// 영상·문서·게시물 링크" /></label>
                {s?.status === 'revise' && s.feedback && <div className="info-note warn">피드백을 반영했는지 한 번 더 확인해 보세요: {s.feedback.slice(0, 80)}{s.feedback.length > 80 ? '…' : ''}</div>}
                <div className="between"><Button small secondary onClick={() => setDraft(null)}>취소</Button><Button small type="submit" disabled={busy || (!draft.body.trim() && !draft.link.trim())}><Send size={15} /> {s ? '다시 제출' : '제출하기'}</Button></div>
              </form>
            ) : (
              <div className="between">
                {a.lesson_id ? <button className="text-link" onClick={() => go('/lesson/' + a.lesson_id)}>관련 강의 보기</button> : <span />}
                {(!s || s.status === 'revise') && <Button small onClick={() => setDraft({ id: a.id, body: s?.body || '', link: s?.link || '' })}><ClipboardList size={15} /> {s ? '보완하여 다시 제출' : '과제 제출'}</Button>}
                {s?.status === 'submitted' && <Button small secondary onClick={() => setDraft({ id: a.id, body: s.body, link: s.link })}><PenLine size={14} /> 제출물 수정</Button>}
              </div>
            )}
          </div>
        );
      }) : <Empty title={tab === 'all' ? '등록된 과제가 없어요' : '해당하는 과제가 없어요'} description="과정에 실습 과제가 등록되면 이곳에서 제출할 수 있어요." icon={ClipboardList} />}
    </>
  );
}

function StatMini({ label, value, warn = false }: { label: string; value: string; warn?: boolean }) {
  return <div className={'stat-card mini' + (warn ? ' warn' : '')}><p>{label}</p><b>{value}</b></div>;
}

