'use client';
import { useState } from 'react';
import { Users, BookOpen, Video, CheckCircle2, MessageCircle, ChevronRight, Plus, ClipboardList, Activity, Trophy, Clock, AlertTriangle, BellRing, HelpCircle } from 'lucide-react';
import { atRisk } from '../../../lib/insights';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { useEdu } from '../../../lib/edu-store';
import { addDays, kstDay, relTime, fmtLong } from '../../../lib/learning';
import { Button, CharacterAvatar, Empty, PageHead, Pill, StatCard, statusLabel, statusTone } from '../ui';

const KIND_LABEL: Record<string, string> = { login: '로그인', lesson_complete: '강의 완료', quiz: '퀴즈 응시', question: '질문', submit: '과제 제출', certificate: '수료', reply: '답변', member_status: '교육생 상태 변경', member_role: '역할 변경', course_delete: '과정 삭제', lesson_delete: '강의 삭제', review_submission: '과제 검토', password_reset: '비밀번호 재설정', member_delete: '교육생 삭제' };

export function AdminDashboard() {
  const { data, courses, lessons, go, openModal, ls, pct } = useEdu();
  const [nowMs] = useState(() => Date.now());
  if (!data) return null;
  const users = data.users ?? [], ps = data.allProgress ?? [];
  const students = users.filter((u) => u.role === 'student');
  const finished = ps.filter((p) => p.complete).length;
  const today = kstDay();
  const series = Array.from({ length: 30 }, (_, i) => { const day = addDays(today, i - 29); const d = (data.daily ?? []).find((x) => x.day === day); return { day, label: day.slice(5).replace('-', '/'), learners: d?.learners || 0, minutes: Math.round((d?.seconds || 0) / 60), completed: d?.completed || 0 }; });
  const activeWeek = (data.daily ?? []).filter((d) => d.day >= addDays(today, -6)).reduce((m, d) => Math.max(m, d.learners), 0);
  const funnel = [
    ['가입', students.length],
    ['승인', students.filter((u) => u.status === 'active').length],
    ['첫 시청', new Set(ps.filter((p) => p.watched > 0).map((p) => p.user_id)).size],
    ['강의 완료', new Set(ps.filter((p) => p.complete).map((p) => p.user_id)).size],
    ['수료', new Set((data.allCertificates ?? []).map((c) => c.user_id)).size],
  ] as [string, number][];
  const pendingTasks: [any, string, number, string][] = [
    [Users, '승인 대기 교육생', students.filter((u) => u.status === 'pending').length, '/admin/members?status=pending'],
    [MessageCircle, '답변 대기 질문', data.messages.filter((m) => !m.reply).length, '/admin/questions'],
    [ClipboardList, '검토 대기 과제', (data.submissions ?? []).filter((s) => s.status === 'submitted').length, '/admin/assignments'],
    [Video, '영상 등록 예정', lessons.filter((l) => !l.video).length, '/admin/videos'],
  ];
  return (
    <>
      <PageHead title="교육 운영을 한눈에." sub="교육생의 시작부터 수료까지, 학습의 흐름을 관리하세요." action={<Button small onClick={() => openModal('course', { title: '', description: '', category: '입문', level: '입문', image: 1, position: courses.length + 1, published: 0, objectives: '', instructor: '' })}><Plus size={17} /> 교육 과정 등록</Button>} />
      <div className="stats-grid">
        <StatCard icon={Users} label="전체 교육생" value={students.length + '명'} sub={`승인 대기 ${students.filter((u) => u.status === 'pending').length}명`} />
        <StatCard icon={Activity} label="최근 7일 최대 동시 학습자" value={activeWeek + '명'} sub={`오늘 ${series[29].learners}명 · ${series[29].minutes}분`} />
        <StatCard icon={CheckCircle2} label="누적 강의 완료" value={finished + '회'} sub={`운영 과정 ${courses.filter((c) => c.published).length}개 · 영상 ${lessons.filter((l) => l.video).length}개`} />
        <StatCard icon={Trophy} label="수료증 발급" value={(data.allCertificates ?? []).length + '건'} />
      </div>

      <div className="admin-two">
        <div className="panel chart-panel">
          <div className="section-heading"><div><h2>최근 30일 학습자</h2><p className="muted">하루에 한 번 이상 학습한 교육생 수</p></div></div>
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={series} margin={{ top: 8, right: 8, left: -18, bottom: 0 }} barCategoryGap={2}>
                <CartesianGrid vertical={false} stroke="var(--line)" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--muted)' }} tickLine={false} axisLine={false} interval={6} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'var(--muted)' }} tickLine={false} axisLine={false} width={34} />
                <Tooltip cursor={{ fill: 'var(--light)' }} contentStyle={{ borderRadius: 12, border: '1px solid var(--line)', fontSize: 13 }} formatter={(v: any, name: any) => [v, name === 'learners' ? '학습자' : name]} labelFormatter={(l) => `${l}`} />
                <Bar dataKey="learners" name="학습자" fill="var(--purple)" radius={[4, 4, 0, 0]} maxBarSize={18} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="chart-foot"><span><Clock size={14} /> 30일 총 학습 {fmtLong(series.reduce((s, d) => s + d.minutes * 60, 0))}</span><span><CheckCircle2 size={14} /> 완료 {series.reduce((s, d) => s + d.completed, 0)}강</span></div>
        </div>
        <div className="panel admin-tasks">
          <h2>오늘 확인할 일</h2>
          {pendingTasks.map(([Icon, t, n, p]) => <button key={t} onClick={() => go(p)} className={n > 0 ? 'has' : ''}><span><Icon size={20} />{t}</span><b>{n}<ChevronRight size={17} /></b></button>)}
          <h3 className="funnel-title">학습 퍼널</h3>
          <div className="funnel">{funnel.map(([l, n], i) => <div key={l}><span>{l}</span><div className="progress-track small"><i style={{ width: (funnel[0][1] ? (n / funnel[0][1]) * 100 : 0) + '%', opacity: 1 - i * 0.12 }} /></div><b>{n}</b></div>)}</div>
        </div>
      </div>

      {(() => {
        const risk = atRisk(users, lessons.length, nowMs);
        const hard = Object.entries(data.quizStats ?? {}).filter(([, s]) => s.attempts >= 3).map(([id, s]) => ({ lesson: lessons.find((l) => l.id === id), rate: Math.round((s.passed / s.attempts) * 100), s })).filter((x) => x.lesson).sort((a, b) => a.rate - b.rate).slice(0, 5);
        return (
          <div className="admin-two">
            <div className="panel risk-panel">
              <div className="section-heading"><div><h2><AlertTriangle size={20} className="warn-text" /> 이탈 위험 교육생</h2><p className="muted">승인 후 학습이 멈춘 교육생이에요. 짧은 독려 알림이 복귀율을 높입니다.</p></div>
                {risk.length > 0 && <Button small secondary onClick={() => openModal('nudge', { ids: risk.map((r) => r.user.id), title: '오늘 10분만 학습을 이어가 볼까요?', body: '짧은 배움이 다음 라이브의 자신감이 됩니다. 멈춘 곳부터 이어서 학습해 보세요.', link: '/learn' })}><BellRing size={14} /> {risk.length}명 독려</Button>}</div>
              {risk.length ? <ul className="risk-list">{risk.slice(0, 8).map(({ user: u, reason, level }) => <li key={u.id}><CharacterAvatar index={u.avatar} /><div><b>{u.name}</b><small>{u.completed}강 완료 · {u.last_active ? '마지막 활동 ' + relTime(u.last_active) : '활동 기록 없음'}</small></div><Pill tone={level === 2 ? 'bad' : 'warn'}>{reason}</Pill></li>)}</ul> : <p className="muted small-muted">모든 교육생이 꾸준히 학습하고 있어요.</p>}
              {risk.length > 8 && <button className="text-link" onClick={() => go('/admin/members?status=inactive')}>전체 {risk.length}명 보기 <ChevronRight size={14} /></button>}
            </div>
            <div className="panel">
              <div className="section-heading"><div><h2><HelpCircle size={20} className="purple" /> 어려운 확인 문제</h2><p className="muted">응시 3회 이상 강의 중 통과율이 낮은 순</p></div><button onClick={() => go('/admin/quiz')}>퀴즈 분석 <ChevronRight size={16} /></button></div>
              {hard.length ? hard.map(({ lesson, rate, s }) => <div className="course-analytics" key={lesson!.id}><div><b>{lesson!.title}</b><span className={rate < 50 ? 'bad-text' : ''}>{rate}%</span></div><div className="progress-track"><i style={{ width: rate + '%' }} /></div><small>{courses.find((c) => c.id === lesson!.course_id)?.title} · 응시 {s.attempts}회 · 평균 {s.avg}점</small></div>) : <p className="muted small-muted">아직 분석할 응시 기록이 충분하지 않아요.</p>}
            </div>
          </div>
        );
      })()}

      <div className="admin-two">
        <div className="panel">
          <div className="section-heading"><h2>과정별 학습 현황</h2><button onClick={() => go('/admin/progress')}>상세 보기 <ChevronRight size={16} /></button></div>
          {courses.map((c) => {
            const v = students.length ? Math.round(students.reduce((s, u) => s + pct(c.id, ps.filter((p) => p.user_id === u.id)), 0) / students.length) : 0;
            return <div className="course-analytics" key={c.id}><div><b>{c.title}{!c.published && <Pill> 비공개</Pill>}</b><span>{v}%</span></div><div className="progress-track"><i style={{ width: v + '%' }} /></div><small>교육생 평균 완료율 · {ls(c.id).length}개 강의 · {c.learners}명 시청 · 평점 {c.rating ? c.rating.toFixed(1) : '-'}</small></div>;
          })}
        </div>
        <div className="panel">
          <div className="section-heading"><h2>최근 활동</h2><button onClick={() => go('/admin/activity')}>전체 보기 <ChevronRight size={16} /></button></div>
          {(data.activity ?? []).length ? <ul className="activity-list">{(data.activity ?? []).slice(0, 12).map((a) => <li key={a.id}><b>{a.name}</b> {KIND_LABEL[a.kind] || a.kind}{a.detail && <span> · {a.detail}</span>}<small>{relTime(a.created)}</small></li>)}</ul> : <p className="muted">아직 활동 기록이 없어요.</p>}
        </div>
      </div>

      <div className="panel">
        <div className="section-heading"><h2>최근 교육생</h2><button onClick={() => go('/admin/members')}>전체 관리 <ChevronRight size={16} /></button></div>
        {students.length ? (
          <div className="member-list">
            {students.slice(0, 6).map((u) => (
              <div className="member-summary" key={u.id}>
                <CharacterAvatar index={u.avatar} />
                <div><b>{u.name}</b><p>{u.email}</p></div>
                <Pill tone={statusTone[u.status]}>{statusLabel[u.status]}</Pill>
                <small>{u.completed}강 완료 · {u.last_active ? relTime(u.last_active) : '활동 없음'}</small>
              </div>
            ))}
          </div>
        ) : <Empty title="등록된 교육생이 없어요" description="교육 가입 신청을 승인하면 학습 관리가 시작됩니다." icon={BookOpen} />}
      </div>
    </>
  );
}
