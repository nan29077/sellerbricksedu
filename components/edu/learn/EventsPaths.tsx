'use client';
import { useState } from 'react';
import { CalendarDays, MapPin, Video, Users, CheckCircle2, ExternalLink, Route, ChevronRight, ChevronLeft, Play, RotateCcw, Plus, PenLine, Trash2, BellRing, CalendarPlus, List, PlayCircle, Flag } from 'lucide-react';
import { pace, eta } from '../../../lib/insights';
import { useEdu } from '../../../lib/edu-store';
import { fmtLong, fmtShort } from '../../../lib/learning';
import type { EduEvent } from '../../../lib/types';
import { Button, Empty, PageHead, Pill, Ring, Tabs } from '../ui';

export const fmtDT = (s: string) => (s ? new Date(s).toLocaleString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit' }) : '');
const isPast = (e: EduEvent) => new Date(e.ends || e.starts).getTime() < Date.now() - 3600000;
const isSoon = (e: EduEvent) => { const d = new Date(e.starts).getTime() - Date.now(); return d > 0 && d < 86400000; };
const isLive = (e: EduEvent) => { const s = new Date(e.starts).getTime(), n = Date.now(); return n >= s && n <= eventTimes(e).end.getTime(); };
/** 시작까지 남은 시간 표시 */
function countdown(e: EduEvent) {
  const d = new Date(e.starts).getTime() - Date.now();
  if (d <= 0) return '';
  const h = Math.floor(d / 3600000), m = Math.floor((d % 3600000) / 60000);
  if (h >= 48) return `${Math.floor(h / 24)}일 후`;
  if (h >= 1) return `${h}시간 ${m}분 후`;
  return `${Math.max(1, m)}분 후 시작`;
}

const icsDate = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const icsEsc = (t: string) => t.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/[,;]/g, (m) => '\\' + m);
function eventTimes(e: EduEvent) {
  const start = new Date(e.starts);
  const end = e.ends ? new Date(e.ends) : new Date(start.getTime() + 3600000);
  return { start, end: end > start ? end : new Date(start.getTime() + 3600000) };
}
function eventDetails(e: EduEvent, withLink: boolean) {
  return [e.description, withLink && e.link ? '입장 링크: ' + e.link : '', typeof location !== 'undefined' ? location.origin + '/learn/events' : ''].filter(Boolean).join('\n\n');
}
/** .ics 파일 내려받기 (애플·아웃룩·삼성 캘린더 등) */
export function downloadIcs(e: EduEvent, withLink: boolean) {
  const { start, end } = eventTimes(e);
  const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Sellerbricks Campus//Events//KO', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'BEGIN:VEVENT',
    `UID:${e.id}@sellerbricks-campus`, `DTSTAMP:${icsDate(new Date())}`, `DTSTART:${icsDate(start)}`, `DTEND:${icsDate(end)}`,
    `SUMMARY:${icsEsc(e.title)}`, `DESCRIPTION:${icsEsc(eventDetails(e, withLink))}`, ...(e.location ? [`LOCATION:${icsEsc(e.location)}`] : []), ...(withLink && e.link ? [`URL:${e.link}`] : []),
    'BEGIN:VALARM', 'TRIGGER:-PT30M', 'ACTION:DISPLAY', `DESCRIPTION:${icsEsc(e.title)}`, 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
  const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url; a.download = `${e.title.replace(/[\\/:*?"<>|]/g, '').slice(0, 40) || 'event'}.ics`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function googleCalendarUrl(e: EduEvent, withLink: boolean) {
  const { start, end } = eventTimes(e);
  const q = new URLSearchParams({ action: 'TEMPLATE', text: e.title, dates: `${icsDate(start)}/${icsDate(end)}`, details: eventDetails(e, withLink), location: e.location || '' });
  return 'https://calendar.google.com/calendar/render?' + q.toString();
}

export function EventCard({ e, adminView = false }: { e: EduEvent; adminView?: boolean }) {
  const { perform, busy, openModal, ask, data, act, setToast } = useEdu();
  const past = isPast(e);
  const attendees = (data?.rsvps ?? []).filter((r) => r.event_id === e.id);
  return (
    <div className={'panel event-card ' + (past ? 'past' : '') + (isSoon(e) ? ' soon' : '')}>
      <div className="event-date"><b>{new Date(e.starts).getDate()}</b><small>{new Date(e.starts).toLocaleDateString('ko-KR', { month: 'short' })}</small></div>
      <div className="event-body">
        <div className="qa-meta">{e.cohort_name ? <Pill>{e.cohort_name}</Pill> : <Pill tone="info">전체</Pill>}{isLive(e) ? <Pill tone="bad">● 진행 중</Pill> : isSoon(e) ? <Pill tone="warn">{countdown(e)}</Pill> : !past && <Pill>{countdown(e)}</Pill>}{past && <Pill>종료</Pill>}{e.replay && <Pill tone="good">다시보기</Pill>}{e.capacity > 0 && <Pill>{e.going}/{e.capacity}명</Pill>}</div>
        <h3>{e.title}</h3>
        <p className="event-when"><CalendarDays size={14} /> {fmtDT(e.starts)}{e.ends ? ` ~ ${new Date(e.ends).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}` : ''}{e.location && <> · <MapPin size={13} /> {e.location}</>}</p>
        {e.description && <p className="note-text clamp">{e.description}</p>}
        <div className="admin-actions">
          {!adminView && !past && <Button small={true} secondary={!!e.mine} disabled={busy} onClick={() => perform('rsvp', { eventId: e.id }, e.mine ? '참석 신청을 취소했습니다.' : '참석 신청을 완료했습니다. 시작 전 알림을 보내드려요.')}>{e.mine ? <><CheckCircle2 size={14} /> 신청 완료 · 취소</> : <><Users size={14} /> 참석 신청</>}</Button>}
          {e.replay && (past || adminView) && <a className="button small" href={e.replay} target="_blank" rel="noopener noreferrer"><PlayCircle size={14} /> 다시보기</a>}
          {past && adminView && !e.replay && <Button small secondary onClick={() => openModal('event', { ...e, cohortId: e.cohort_id || '' })}><PlayCircle size={14} /> 다시보기 등록</Button>}
          {e.link && (e.mine || adminView) && !past && <a className="button secondary small" href={e.link} target="_blank" rel="noopener noreferrer"><Video size={14} /> 세션 입장 <ExternalLink size={12} /></a>}
          {!past && <details className="cal-add"><summary><CalendarPlus size={14} /> 캘린더에 추가</summary><div><a href={googleCalendarUrl(e, !!e.mine || adminView)} target="_blank" rel="noopener noreferrer">구글 캘린더</a><button onClick={() => downloadIcs(e, !!e.mine || adminView)}>애플·아웃룩 (.ics)</button></div></details>}
          {!adminView && <span className="small-muted">{e.going}명 참석 예정</span>}
          {adminView && <>
            <Button small secondary onClick={() => openModal('event', { ...e, cohortId: e.cohort_id || '' })}><PenLine size={14} /> 편집</Button>
            <Button small secondary onClick={async () => { try { const r = await act('event_remind', { id: e.id }); setToast(`${r.count}명에게 리마인드를 보냈습니다.`); } catch (err: any) { setToast(err.message, 'error'); } }} disabled={!e.going}><BellRing size={14} /> 리마인드 ({e.going})</Button>
            {attendees.length > 0 && <details className="attendees"><summary>참석자 {attendees.length}명</summary><ul>{attendees.map((a) => <li key={a.user_id}>{a.name} <small>{a.email}</small></li>)}</ul></details>}
            <Button small secondary danger onClick={async () => { if (await ask('일정을 삭제할까요?', '참석 신청도 함께 삭제됩니다.', { danger: true, confirmLabel: '삭제' })) perform('event_delete', { id: e.id }, '일정을 삭제했습니다.'); }}><Trash2 size={14} /></Button>
          </>}
        </div>
      </div>
    </div>
  );
}

/** 월간 캘린더 — 날짜를 누르면 그날 일정만 보여준다 */
function MonthCalendar({ events, adminView }: { events: EduEvent[]; adminView: boolean }) {
  const [cursor, setCursor] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [picked, setPicked] = useState<string | null>(null);
  const y = cursor.getFullYear(), m = cursor.getMonth();
  const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const first = new Date(y, m, 1), offset = (first.getDay() + 6) % 7, daysIn = new Date(y, m + 1, 0).getDate();
  const cells = Array.from({ length: Math.ceil((offset + daysIn) / 7) * 7 }, (_, i) => { const n = i - offset + 1; return n >= 1 && n <= daysIn ? new Date(y, m, n) : null; });
  const byDay = (k: string) => events.filter((e) => key(new Date(e.starts)) === k);
  const today = key(new Date());
  const list = picked ? byDay(picked) : events.filter((e) => { const d = new Date(e.starts); return d.getFullYear() === y && d.getMonth() === m; }).sort((a, b) => a.starts.localeCompare(b.starts));
  return (
    <>
      <div className="panel month-cal">
        <div className="between"><button className="icon-button" aria-label="이전 달" onClick={() => { setCursor(new Date(y, m - 1, 1)); setPicked(null); }}><ChevronLeft size={18} /></button><b>{y}년 {m + 1}월</b><button className="icon-button" aria-label="다음 달" onClick={() => { setCursor(new Date(y, m + 1, 1)); setPicked(null); }}><ChevronRight size={18} /></button></div>
        <div className="cal-grid">
          {['월', '화', '수', '목', '금', '토', '일'].map((d) => <span key={d} className="cal-dow">{d}</span>)}
          {cells.map((d, i) => { if (!d) return <span key={i} />; const k = key(d), evs = byDay(k); return (
            <button key={i} className={'cal-day' + (k === today ? ' today' : '') + (k === picked ? ' picked' : '') + (evs.length ? ' has' : '')} onClick={() => setPicked(k === picked ? null : k)} aria-label={`${d.getDate()}일 일정 ${evs.length}개`}>
              <span>{d.getDate()}</span>
              {evs.slice(0, 2).map((e) => <i key={e.id} className={e.mine ? 'mine' : ''}>{e.title}</i>)}
              {evs.length > 2 && <small>+{evs.length - 2}</small>}
            </button>
          ); })}
        </div>
      </div>
      <p className="small-muted cal-caption">{picked ? `${fmtShort(picked)} 일정 ${list.length}개` : `${m + 1}월 일정 ${list.length}개`}{picked && <button className="text-link" onClick={() => setPicked(null)}> · 월 전체 보기</button>}</p>
      {list.length ? list.map((e) => <EventCard key={e.id} e={e} adminView={adminView} />) : <Empty title="이 기간에는 일정이 없어요" icon={CalendarDays} />}
    </>
  );
}

export function EventsPage({ adminView = false }: { adminView?: boolean }) {
  const { data, openModal } = useEdu();
  const [tab, setTab] = useState<'upcoming' | 'mine' | 'past'>('upcoming');
  const [view, setView] = useState<'list' | 'calendar'>('list');
  if (!data) return null;
  const live = data.events.filter(isLive);
  const list = data.events.filter((e) => tab === 'past' ? isPast(e) : tab === 'mine' ? !!e.mine && !isPast(e) : !isPast(e)).sort((a, b) => tab === 'past' ? b.starts.localeCompare(a.starts) : a.starts.localeCompare(b.starts));
  return (
    <>
      <PageHead title={adminView ? '라이브 세션·일정 관리' : '라이브 세션·일정'} sub={adminView ? '기수별 OT, 라이브 Q&A, 특강 일정을 등록하면 교육생에게 알림이 전달됩니다.' : '라이브 OT, Q&A 세션, 특강에 참석 신청하고 동료 셀러와 함께 배우세요.'} action={adminView ? <Button small onClick={() => openModal('event', { title: '', description: '', starts: '', ends: '', link: '', location: '온라인', cohortId: '', capacity: 0, notify: true })}><Plus size={16} /> 일정 등록</Button> : undefined} />
      {live.map((e) => <div className="live-banner" key={e.id}><span className="live-dot" /><b>지금 진행 중 · {e.title}</b>{e.link && (e.mine || adminView) ? <a className="button small" href={e.link} target="_blank" rel="noopener noreferrer"><Video size={14} /> 바로 입장</a> : <small>참석 신청한 교육생에게 입장 링크가 열려요</small>}</div>)}
      <div className="filter-row">
        {view === 'list' ? <Tabs items={[['upcoming', `예정 (${data.events.filter((e) => !isPast(e)).length})`], ...(adminView ? [] : [['mine', `내 신청 (${data.events.filter((e) => !!e.mine && !isPast(e)).length})`] as any]), ['past', `지난 일정 (${data.events.filter(isPast).length})`]]} value={tab} onChange={setTab} /> : <span />}
        <div className="seg" role="tablist" aria-label="보기 방식"><button className={view === 'list' ? 'selected' : ''} onClick={() => setView('list')}><List size={14} /> 목록</button><button className={view === 'calendar' ? 'selected' : ''} onClick={() => setView('calendar')}><CalendarDays size={14} /> 캘린더</button></div>
      </div>
      {view === 'calendar' ? <MonthCalendar events={data.events} adminView={adminView} /> : list.length ? list.map((e) => <EventCard key={e.id} e={e} adminView={adminView} />) : <Empty title={tab === 'mine' ? '신청한 일정이 없어요' : '예정된 일정이 없어요'} description={adminView ? '첫 라이브 세션을 등록해 보세요.' : '새 일정이 등록되면 알림으로 안내해 드려요.'} icon={CalendarDays} />}
    </>
  );
}

export function PathsPage({ adminView = false }: { adminView?: boolean }) {
  const { data, courses, ls, pct, pfor, go, openModal, perform, ask, superAdmin } = useEdu();
  if (!data) return null;
  const paths = data.paths;
  const perDay = pace(data.learningDays);
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
                <small className="muted">{cs.length}개 과정 · {all.length}강 · {fmtLong(all.reduce((s, l) => s + l.duration, 0))}{!adminView && ` · 완료 ${done}강 · 남은 학습 ${fmtLong(all.filter((l) => !pfor(l.id).complete).reduce((s, l) => s + l.duration, 0))}`}</small>
                {!adminView && done < all.length && <small className="path-eta"><Flag size={12} /> {(() => { const d = eta(all.length - done, perDay); return d ? `지금 속도(하루 ${perDay.toFixed(1)}강)라면 ${fmtShort(d)} 완주 예정` : '최근 4주 학습 기록이 쌓이면 예상 완주일을 알려드려요'; })()}</small>}
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
