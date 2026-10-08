'use client';
import { useMemo, useState } from 'react';
import { Plus, PenLine, Trash2, HelpCircle, BarChart3, AlertTriangle, Download, Upload, Database } from 'lucide-react';
import { useEdu } from '../../../lib/edu-store';
import { downloadCsv } from '../../../lib/learning';
import { Button, Empty, PageHead, Pill, ProgressBar } from '../ui';

export function AdminFaqs() {
  const { data, openModal, perform, ask } = useEdu();
  if (!data) return null;
  const list = [...data.faqs].sort((a, b) => a.position - b.position);
  return (
    <>
      <PageHead title="FAQ 관리" sub="공개 페이지의 '자주 묻는 질문'에 표시됩니다." action={<Button small onClick={() => openModal('faq', { question: '', answer: '', position: list.length + 1, published: 1 })}><Plus size={16} /> FAQ 추가</Button>} />
      {list.length ? list.map((f) => (
        <div className="panel faq-admin" key={f.id}>
          <div className="between"><h3><HelpCircle size={16} className="purple" /> {f.question}</h3><Pill tone={f.published ? 'good' : ''}>{f.published ? '공개' : '비공개'}</Pill></div>
          <p className="note-text">{f.answer}</p>
          <div className="admin-actions"><Button small secondary onClick={() => openModal('faq', f)}><PenLine size={14} /> 편집</Button><Button small secondary danger onClick={async () => { if (await ask('FAQ를 삭제할까요?', undefined, { danger: true, confirmLabel: '삭제' })) perform('faq_delete', { id: f.id }, '삭제했습니다.'); }}><Trash2 size={14} /></Button></div>
        </div>
      )) : <Empty title="FAQ가 없어요" icon={HelpCircle} />}
    </>
  );
}

export function AdminQuiz() {
  const { data, courses, lessons, openModal } = useEdu();
  const [courseId, setCourseId] = useState('all');
  const stats = data?.quizStats ?? {};
  const rows = useMemo(() => lessons.filter((l) => courseId === 'all' || l.course_id === courseId).map((l) => ({ l, s: stats[l.id] })).filter((r) => r.s), [lessons, courseId, stats]);
  if (!data) return null;
  const totalAttempts = Object.values(stats).reduce((s, x) => s + x.attempts, 0);
  const totalPassed = Object.values(stats).reduce((s, x) => s + x.passed, 0);
  const hard = Object.entries(stats).flatMap(([lid, s]) => s.perQuestion.map((q, i) => ({ lid, i, rate: q.total ? q.correct / q.total : 1, total: q.total }))).filter((q) => q.total >= 3).sort((a, b) => a.rate - b.rate).slice(0, 5);
  return (
    <>
      <PageHead title="퀴즈 분석" sub="강의별 응시·통과율과 문항별 정답률로 어려운 문항과 보완할 강의를 찾으세요." action={<Button small secondary onClick={() => downloadCsv('sellerbricks-quiz.csv', [['과정', '강의', '응시', '통과', '통과율', '평균'], ...rows.map(({ l, s }) => [courses.find((c) => c.id === l.course_id)?.title || '', l.title, s.attempts, s.passed, Math.round((s.passed / s.attempts) * 100) + '%', s.avg])])}><Download size={15} /> CSV</Button>} />
      <div className="stats-grid">
        <div className="stat-card"><span><BarChart3 size={22} /></span><p>총 응시</p><b>{totalAttempts}회</b></div>
        <div className="stat-card"><span><BarChart3 size={22} /></span><p>전체 통과율</p><b>{totalAttempts ? Math.round((totalPassed / totalAttempts) * 100) : 0}%</b></div>
        <div className="stat-card"><span><BarChart3 size={22} /></span><p>응시된 강의</p><b>{Object.keys(stats).length} / {lessons.length}</b></div>
        <div className="stat-card"><span><AlertTriangle size={22} /></span><p>정답률 50% 미만 문항</p><b>{hard.filter((h) => h.rate < 0.5).length}개</b></div>
      </div>
      {hard.length > 0 && (
        <div className="panel">
          <h3><AlertTriangle size={18} className="warn-text" /> 가장 어려운 문항</h3>
          {hard.map((h) => { const l = lessons.find((x) => x.id === h.lid); const q = data.questions?.find((x) => x.id === h.lid)?.questions[h.i]; return <div className="report-row" key={h.lid + h.i}><b>{l?.title} · Q{h.i + 1}</b><span>{q?.question}</span><Pill tone={h.rate < 0.5 ? 'bad' : 'warn'}>정답률 {Math.round(h.rate * 100)}% ({h.total}회)</Pill></div>; })}
        </div>
      )}
      <div className="filter-row"><select value={courseId} onChange={(e) => setCourseId(e.target.value)} aria-label="과정"><option value="all">모든 과정</option>{courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</select><span className="small-muted">{rows.length}개 강의</span></div>
      {rows.length ? rows.map(({ l, s }) => (
        <div className="panel quiz-stat" key={l.id}>
          <div className="between"><div><span className="course-label">{courses.find((c) => c.id === l.course_id)?.title}</span><h3>{l.title}</h3></div><div className="qa-meta"><Pill>{s.attempts}회 응시</Pill><Pill tone={s.passed / s.attempts >= 0.7 ? 'good' : 'warn'}>통과 {Math.round((s.passed / s.attempts) * 100)}%</Pill><Pill>평균 {s.avg}점</Pill></div></div>
          <div className="question-rates">
            {s.perQuestion.map((q, i) => { const rate = q.total ? Math.round((q.correct / q.total) * 100) : 0; const def = data.questions?.find((x) => x.id === l.id)?.questions[i]; return <div key={i}><div className="between"><span>Q{i + 1}. {def?.question}</span><b className={rate < 50 ? 'warn-text' : ''}>{rate}%</b></div><ProgressBar value={rate} small /></div>; })}
          </div>
          <div className="admin-actions"><Button small secondary onClick={() => openModal('lesson', { ...l, chapters: JSON.stringify(l.chapters || [], null, 2), questions: JSON.stringify(data.questions?.find((x) => x.id === l.id)?.questions || [], null, 2) })}><PenLine size={14} /> 문항 편집</Button></div>
        </div>
      )) : <Empty title="아직 응시 기록이 없어요" description="교육생이 확인 문제를 풀면 통계가 쌓입니다." icon={BarChart3} />}
    </>
  );
}

export function ContentTransfer() {
  const { openModal } = useEdu();
  return (
    <div className="panel">
      <h3><Database size={22} /> 콘텐츠 백업·이전</h3>
      <p className="muted">과정·강의·과제·FAQ·학습 경로를 JSON으로 내보내거나 가져옵니다. 교육생 데이터는 포함되지 않습니다. 로컬에서 만든 콘텐츠를 운영에 옮길 때 사용하세요.</p>
      <div className="admin-actions"><Button small secondary onClick={() => { location.assign('/api/edu?export=content'); }}><Download size={14} /> JSON 내보내기</Button><Button small secondary onClick={() => openModal('content_import', { data: '' })}><Upload size={14} /> JSON 가져오기</Button></div>
    </div>
  );
}
