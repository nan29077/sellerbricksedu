'use client';
import { BookOpen, CheckCircle2, Clock, Trophy, Play, ChevronRight, Flame, Target, GraduationCap, Megaphone, ClipboardList, Award, Pin, CalendarDays, MessagesSquare } from 'lucide-react';
import { useState } from 'react';
import { useEdu } from '../../../lib/edu-store';
import { fmt, fmtLong, fmtShort, streak, thisWeek, heatmap, badges, kstDay } from '../../../lib/learning';
import { Button, PageHead, Ring, StatCard, Pill } from '../ui';
import { fmtDT } from './EventsPaths';
import { CourseCard } from '../public/CourseCard';

export function Heatmap({ weeks = 16 }: { weeks?: number }) {
  const { data } = useEdu();
  const cells = heatmap(data?.learningDays ?? [], weeks);
  const level = (s: number, c: number) => (c > 0 || s >= 1800 ? 4 : s >= 900 ? 3 : s >= 300 ? 2 : s > 0 ? 1 : 0);
  const months: { col: number; label: string }[] = [];
  cells.forEach((c, i) => { if (i % 7 === 0) { const label = Number(c.day.slice(5, 7)) + '월'; if (!months.length || months[months.length - 1].label !== label) months.push({ col: i / 7, label }); } });
  return (
    <div className="heatmap" role="img" aria-label="최근 학습 기록">
      <div className="heatmap-months">{months.map((m) => <span key={m.col} style={{ gridColumnStart: m.col + 1 }}>{m.label}</span>)}</div>
      <div className="heatmap-grid" style={{ gridTemplateColumns: `repeat(${weeks}, 1fr)` }}>
        {cells.map((c) => <i key={c.day} className={`l${c.future ? 'f' : level(c.seconds, c.completed)}`} title={`${c.day} · ${Math.round(c.seconds / 60)}분${c.completed ? ` · ${c.completed}강 완료` : ''}`} />)}
      </div>
      <div className="heatmap-legend"><span>적음</span>{[0, 1, 2, 3, 4].map((l) => <i key={l} className={`l${l}`} />)}<span>많음</span></div>
    </div>
  );
}

export function Dashboard() {
  const { user, data, courses, lessons, progress, go, pfor, ls, pct, perform } = useEdu();
  void ls;
  const [nowMs] = useState(() => Date.now());
  if (!user || !data) return null;
  const done = progress.filter((p) => p.complete).length;
  const last = [...progress].sort((a, b) => b.updated.localeCompare(a.updated)).find((p) => !p.complete && p.watched > 0);
  const next = lessons.find((l) => l.id === last?.lesson_id) || lessons.find((l) => !pfor(l.id).complete) || lessons[0];
  const nextCourse = courses.find((c) => c.id === next?.course_id);
  const st = streak(data.learningDays);
  const week = thisWeek(data.learningDays);
  const goal = user.weekly_goal || 3;
  const cohort = data.cohorts.find((c) => c.id === data.memberships.find((m) => m.user_id === user.id)?.cohort_id);
  const myBadges = badges(progress, data.learningDays, data.certificates.length, data.notes.length, data.messages.filter((m) => m.user_id === user.id).length);
  const earned = myBadges.filter((b) => b.earned);
  const pendingAssignments = data.assignments.filter((a) => !data.submissions.some((s) => s.assignment_id === a.id && s.status !== 'revise'));
  const today = data.learningDays.find((d) => d.day === kstDay());
  const inProgress = courses.filter((c) => { const p = pct(c.id); return p > 0 && p < 100; });
  const recommended = courses.filter((c) => pct(c.id) === 0).slice(0, 3);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? '좋은 아침이에요' : hour < 18 ? '오늘도 한 단계 성장해요' : '오늘 하루도 수고했어요';

  return (
    <>
      <PageHead title={`${user.name}님, ${greeting}.`} sub={st > 0 ? `${st}일 연속 학습 중이에요. 지금의 배움이 다음 라이브의 자신감이 됩니다.` : '오늘 첫 강의로 학습 루틴을 시작해 보세요.'} />
      <div className="cohort-banner">
        <GraduationCap size={20} />
        <span>{cohort?.name || '기수 배정 대기'}</span>
        <small>나의 교육 기수{cohort?.starts ? ` · ${fmtShort(cohort.starts)}${cohort.ends ? ` ~ ${fmtShort(cohort.ends)}` : ''}` : ''}</small>
        <button onClick={() => go('/learn/community')}>동료 셀러 만나기</button>
      </div>

      <div className="dash-top">
        <div className="panel streak-panel">
          <div className="streak-main">
            <span className={'streak-flame ' + (st > 0 ? 'on' : '')}><Flame size={30} /></span>
            <div><b>{st}일</b><p>연속 학습</p></div>
          </div>
          <div className="streak-today">{today && today.seconds >= 60 ? <><CheckCircle2 size={15} /> 오늘 {Math.round(today.seconds / 60)}분 학습했어요</> : <>오늘 아직 학습 기록이 없어요</>}</div>
          <Heatmap weeks={12} />
        </div>
        <div className="panel goal-panel">
          <div className="section-heading"><div><h3><Target size={18} className="purple" /> 이번 주 목표</h3><p className="muted">주 {goal}개 강의 완료</p></div>
            <select aria-label="주간 목표" value={goal} onChange={(e) => perform('preferences', { weeklyGoal: e.target.value }, '주간 목표를 변경했습니다.')}>{[1, 2, 3, 4, 5, 7, 10].map((n) => <option key={n} value={n}>주 {n}개</option>)}</select>
          </div>
          <div className="goal-body">
            <Ring value={Math.min(100, Math.round((week.completed / goal) * 100))} size={96} stroke={9}><b>{week.completed}</b><small>/ {goal}</small></Ring>
            <ul>
              <li><Clock size={15} /> 이번 주 {fmtLong(week.seconds)} 학습</li>
              <li><CheckCircle2 size={15} /> {week.completed}개 강의 완료</li>
              <li><Award size={15} /> 배지 {earned.length} / {myBadges.length}</li>
            </ul>
          </div>
          {week.completed >= goal ? <div className="info-note good">이번 주 목표를 달성했어요! 🎉</div> : <p className="small-muted">{goal - week.completed}개만 더 완료하면 목표 달성이에요.</p>}
        </div>
      </div>

      <div className="stats-grid">
        <StatCard icon={BookOpen} label="학습 중인 과정" value={inProgress.length + '개'} />
        <StatCard icon={CheckCircle2} label="완료한 강의" value={`${done} / ${lessons.length}`} />
        <StatCard icon={Clock} label="누적 학습 시간" value={fmtLong(progress.reduce((s, p) => s + (p.watched || 0), 0))} />
        <StatCard icon={Trophy} label="수료한 과정" value={data.certificates.length + '개'} />
      </div>

      {next && (
        <div className="resume-card">
          <div>
            <span className="pill">{last ? '이어서 학습' : '오늘의 다음 학습'}</span>
            <h2>{next.title}</h2>
            <p>{nextCourse?.title} · {last ? `${fmt(pfor(next.id).position || 0)}부터 이어보기` : `${fmt(next.duration)} · 확인 문제 ${next.questions.length}개`}</p>
            <Button onClick={() => go('/lesson/' + next.id)}><Play size={17} fill="currentColor" />{last ? '이어서 학습하기' : done ? '다음 강의 시작' : '첫 학습 시작하기'}</Button>
          </div>
          <img src={`/images/banner-${nextCourse?.image || 1}.webp`} alt="" />
        </div>
      )}

      {(() => { const up = data.events.filter((e) => new Date(e.ends || e.starts).getTime() > nowMs).sort((a, b) => a.starts.localeCompare(b.starts))[0]; return up ? (
        <div className="event-banner"><CalendarDays size={20} /><div><b>{up.title}</b><small>{fmtDT(up.starts)} · {up.mine ? '참석 신청 완료' : `${up.going}명 참석 예정`}</small></div><Button small secondary={!!up.mine} onClick={() => go('/learn/events')}>{up.mine ? '일정 보기' : '참석 신청'}</Button></div>
      ) : null; })()}
      <div className="dash-two">
        <div className="panel">
          <div className="section-heading"><div><h3><Megaphone size={18} className="purple" /> 공지사항</h3></div><button onClick={() => go('/learn/notices')}>전체 보기 <ChevronRight size={15} /></button></div>
          {data.announcements.length ? data.announcements.slice(0, 4).map((a) => <button className="list-row" key={a.id} onClick={() => go('/learn/notices')}>{a.pinned ? <Pin size={14} className="purple" /> : <span className="dot" />}<b>{a.title}</b><small>{fmtShort(a.created)}</small></button>) : <p className="muted small-muted">새 공지가 없어요.</p>}
        </div>
        <div className="panel">
          <div className="section-heading"><div><h3><ClipboardList size={18} className="purple" /> 제출할 과제</h3></div><button onClick={() => go('/learn/assignments')}>전체 보기 <ChevronRight size={15} /></button></div>
          {pendingAssignments.length ? pendingAssignments.slice(0, 4).map((a) => <button className="list-row" key={a.id} onClick={() => go('/learn/assignments')}><span className="dot warn" /><b>{a.title}</b><small>{a.due ? `마감 ${fmtShort(a.due)}` : courses.find((c) => c.id === a.course_id)?.title}</small></button>) : <p className="muted small-muted">제출할 과제가 없어요.</p>}
        </div>
      </div>

      <div className="section-heading">
        <div><h2>{inProgress.length ? '학습 중인 과정' : '추천 교육 과정'}</h2><p>작은 배움이 쌓여, 더 좋은 방송이 됩니다.</p></div>
        <button onClick={() => go('/learn/courses')}>전체 보기 <ChevronRight size={17} /></button>
      </div>
      <div className="course-grid portal-courses">{(inProgress.length ? inProgress : recommended).slice(0, 3).map((c) => <CourseCard key={c.id} course={c} learning />)}</div>

      {data.posts.length > 0 && (
        <div className="panel">
          <div className="section-heading"><div><h3><MessagesSquare size={18} className="purple" /> 셀러 라운지 새 글</h3></div><button onClick={() => go('/learn/lounge')}>라운지 가기 <ChevronRight size={15} /></button></div>
          {data.posts.slice(0, 4).map((p) => <button className="list-row" key={p.id} onClick={() => go('/learn/lounge/' + p.id)}><Pill>{p.category}</Pill><b>{p.title}</b><small>{p.name} · 댓글 {p.comments}</small></button>)}
        </div>
      )}
      <div className="dashboard-bottom">
        <div className="panel">
          <div className="section-heading"><div><h3><Award size={18} className="purple" /> 나의 배지</h3></div><button onClick={() => go('/learn/achievements')}>전체 보기 <ChevronRight size={15} /></button></div>
          <div className="badge-row">{myBadges.slice(0, 6).map((b) => <span key={b.id} className={'badge ' + (b.earned ? 'earned' : '')} title={b.desc}><i>{b.icon}</i><small>{b.name}</small></span>)}</div>
        </div>
        <div className="panel purple-panel">
          <GraduationCap size={32} />
          <h3>첫 방송까지, 함께 준비해요.</h3>
          <p>무엇부터 시작할지 고민이라면<br />셀러 입문 과정부터 차근차근 배워보세요.</p>
          <Button secondary small onClick={() => go('/course/start')}>입문 과정 보기</Button>
        </div>
      </div>
    </>
  );
}
