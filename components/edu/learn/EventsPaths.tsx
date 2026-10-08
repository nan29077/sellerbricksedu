'use client';
import { useState } from 'react';
import { CalendarDays, MapPin, Video, Users, CheckCircle2, ExternalLink, Route, ChevronRight, Play, RotateCcw, Plus, PenLine, Trash2, BellRing } from 'lucide-react';
import { useEdu } from '../../../lib/edu-store';
import { fmtLong } from '../../../lib/learning';
import type { EduEvent } from '../../../lib/types';
import { Button, Empty, PageHead, Pill, ProgressBar, Ring, Tabs } from '../ui';

export const fmtDT = (s: string) => (s ? new Date(s).toLocaleString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit' }) : '');
const isPast = (e: EduEvent) => new Date(e.ends || e.starts).getTime() < Date.now() - 3600000;
const isSoon = (e: EduEvent) => { const d = new Date(e.starts).getTime() - Date.now(); return d > 0 && d < 86400000; };

export function EventCard({ e, adminView = false }: { e: EduEvent; adminView?: boolean }) {
  const { perform, busy, openModal, ask, data, superAdmin, act, setToast } = useEdu();
  const past = isPast(e);
  const attendees = (data?.rsvps ?? []).filter((r) => r.event_id === e.id);
  return (
    <div className={'panel event-card ' + (past ? 'past' : '') + (isSoon(e) ? ' soon' : '')}>
      <div className="event-date"><b>{new Date(e.starts).getDate()}</b><small>{new Date(e.starts).toLocaleDateString('ko-KR', { month: 'short' })}</small></div>
      <div className="event-body">
        <div className="qa-meta">{e.cohort_name ? <Pill>{e.cohort_name}</Pill> : <Pill tone="info">전체</Pill>}{isSoon(e) && <Pill tone="warn">곧 시작</Pill>}{past && <Pill>종료</Pill>}{e.capacity > 0 && <Pill>{e.going}/{e.capacity}명</Pill>}</div>
        <h3>{e.title}</h3>
        <p className="event-when"><CalendarDays size={14} /> {fmtDT(e.starts)}{e.ends ? ` ~ ${new Date(e.ends).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}` : ''}{e.location && <> · <MapPin size={13} /> {e.location}</>}</p>
        {e.description && <p className="note-text clamp">{e.description}</p>}
        <div className="admin-actions">
          {!adminView && !past && <Button small={true} secondary={!!e.mine} disabled={busy} onClick={() => perform('rsvp', { eventId: e.id }, e.mine ? '참석 신청을 취소했습니다.' : '참석 신청을 완료했습니다. 시작 전 알림을 보내드려요.')}>{e.mine ? <><CheckCircle2 size={14} /> 신청 완료 · 취소</> : <><Users size={14} /> 참석 신청</>}</Button>}
          {e.link && (e.mine || adminView) && !past && <a className="button secondary small" href={e.link} target="_blank" rel="noopener noreferrer"><Video size={14} /> 세션 입장 <ExternalLink size={12} /></a>}
          {!adminView && <span className="small-muted">{e.going}명 참석 예정</span>}
          {adminView && <>
            <Button small secondary onClick={() => openModal('event', { ...e, cohortId: e.cohort_id || '' })}><PenLine size={14} /> 편집</Button>
            <Button small secondary onClick={async () => { try { const r = await act('event_remind', { id: e.id }); setToast(`${r.count}명에게 리마인드를 보냈습니다.`); } catch (err: any) { setToast(err.message, 'error'); } }} disabled={!e.going}><BellRing size={14} /> 리마인드 ({e.going})</Button>
            {attendees.length > 0 && <details className="attendees"><summary>참석자 {attendees.length}명</summary><ul>{attendees.map((a) => <li key={a.user_id}>{a.name} <small>{a.email}</small></li>)}</ul></details>}
            {(superAdmin || true) && <Button small secondary danger onClick={async () => { if (await ask('일정을 삭제할까요?', '참석 신청도 함께 삭제됩니다.', { danger: true, confirmLabel: '삭제' })) perform('event_delete', { id: e.id }, '일정을 삭제했습니다.'); }}><Trash2 size={14} /></Button>}
          </>}
        </div>
      </div>
    </div>
  );
}

export function EventsPage({ adminView = false }: { adminView?: boolean }) {
  const { data, openModal } = useEdu();
  const [tab, setTab] = useState<'upcoming' | 'mine' | 'past'>('upcoming');
  if (!data) return null;
  const list = data.events.filter((e) => tab === 'past' ? isPast(e) : tab === 'mine' ? !!e.mine && !isPast(e) : !isPast(e)).sort((a, b) => tab === 'past' ? b.starts.localeCompare(a.starts) : a.starts.localeCompare(b.starts));
  return (
    <>
      <PageHead title={adminView ? '라이브 세션·일정 관리' : '라이브 세션·일정'} sub={adminView ? '기수별 OT, 라이브 Q&A, 특강 일정을 등록하면 교육생에게 알림이 전달됩니다.' : '라이브 OT, Q&A 세션, 특강에 참석 신청하고 동료 셀러와 함께 배우세요.'} action={adminView ? <Button small onClick={() => openModal('event', { title: '', description: '', starts: '', ends: '', link: '', location: '온라인', cohortId: '', capacity: 0, notify: true })}><Plus size={16} /> 일정 등록</Button> : undefined} />
      <Tabs items={[['upcoming', `예정 (${data.events.filter((e) => !isPast(e)).length})`], ...(adminView ? [] : [['mine', '내 신청'] as any]), ['past', '지난 일정']]} value={tab} onChange={setTab} />
      {list.length ? list.map((e) => <EventCard key={e.id} e={e} adminView={adminView} />) : <Empty title={tab === 'mine' ? '신청한 일정이 없어요' : '예정된 일정이 없어요'} description={adminView ? '첫 라이브 세션을 등록해 보세요.' : '새 일정이 등록되면 알림으로 안내해 드려요.'} icon={CalendarDays} />}
    </>
  );
}

export function PathsPage({ adminView = false }: { adminView?: boolean }) {
  const { data, courses, ls, pct, pfor, go, openModal, perform, ask, superAdmin } = useEdu();
  if (!data) return null;
  const paths = data.paths;
  return (
    <>
      <PageHead title={adminView ? '학습 경로 관리' : '학습 경로'} sub={adminView ? '여러 과정을 순서대로 묶어 목표별 학습 경로를 만드세요.' : '목표에 맞게 과정을 순서대로 묶은 경로를 따라가면 길을 잃지 않아요.'} action={adminView ? <Button small onClick={() => openModal('path', { title: '', description: '', courses: [], position: paths.length + 1, published: 1 })}><Plus size={16} /> 경로 등록</Button> : undefined} />
      {paths.length ? paths.map((p) => {
        const cs = p.courses.map((id) => courses.find((c) => c.id === id)).filter(Boolean) as typeof courses;
        const all = cs.flatMap((c) => ls(c.id));
        const done = all.filter((l) => pfor(l.id).complete).length;
        const percent = all.length ? Math.round((done / all.length) * 100) : 0;
        const nextCourse = cs.find((c) => pct(c.id) < 100);
        const nextLesson = nextCourse ? ls(nextCourse.id).find((l) => !pfor(l.id).complete) : undefined;
        return (
          <div className="panel path-card" key={p.id}>
            <div className="path-head">
              {!adminView && <Ring value={percent} size={64} stroke={6} />}
              <div>
                <div className="qa-meta"><Route size={16} className="purple" /><b>{p.title}</b>{!p.published && <Pill>비공개</Pill>}</div>
                <p className="muted">{p.description}</p>
                <small className="muted">{cs.length}개 과정 · {all.length}강 · {fmtLong(all.reduce((s, l) => s + l.duration, 0))}{!adminView && ` · 완료 ${done}강`}</small>
              </div>
              {!adminView && nextLesson && <Button small onClick={() => go('/lesson/' + nextLesson.id)}><Play size={14} fill="currentColor" /> {percent ? '이어서' : '시작하기'}</Button>}
              {!adminView && !nextLesson && cs.length > 0 && <Pill tone="good"><CheckCircle2 size={12} /> 경로 완주</Pill>}
            </div>
            <ol className="path-steps">
              {cs.map((c, i) => { const v = pct(c.id); return <li key={c.id} className={v === 100 ? 'done' : v > 0 ? 'active' : ''}><span>{v === 100 ? <CheckCircle2 size={15} /> : i + 1}</span><button onClick={() => go('/course/' + c.id)}><b>{c.title}</b><small>{c.category} · {ls(c.id).length}강{!adminView && v > 0 ? ` · ${v}%` : ''}</small></button><ChevronRight size={14} /></li>; })}
            </ol>
            {adminView && <div className="admin-actions"><Button small secondary onClick={() => openModal('path', { ...p })}><PenLine size={14} /> 편집</Button>{superAdmin && <Button small secondary danger onClick={async () => { if (await ask('학습 경로를 삭제할까요?', undefined, { danger: true, confirmLabel: '삭제' })) perform('path_delete', { id: p.id }, '삭제했습니다.'); }}><Trash2 size={14} /></Button>}</div>}
          </div>
        );
      }) : <Empty title="등록된 학습 경로가 없어요" icon={Route} />}
    </>
  );
}

export function ResetCourseButton({ courseId }: { courseId: string }) {
  const { ask, perform } = useEdu();
  return <button className="text-link" onClick={async () => { if (await ask('이 과정의 진도를 초기화할까요?', '시청 기록과 퀴즈 점수가 0으로 돌아갑니다. 발급된 수료증과 노트는 유지됩니다.', { danger: true, confirmLabel: '초기화' })) perform('progress_reset', { courseId }, '진도를 초기화했습니다. 처음부터 다시 학습해 보세요.'); }}><RotateCcw size={13} /> 진도 초기화(재수강)</button>;
}
