'use client';
import { useState } from 'react';
import { ChevronLeft, Video, Clock, CheckCircle2, Play, Target, Lock, Eye, ClipboardList, Users, Trophy } from 'lucide-react';
import { useEdu } from '../../../lib/edu-store';
import { fmt, fmtLong, fmtShort } from '../../../lib/learning';
import { Button, CharacterAvatar, Empty, Pill, ProgressBar, Stars } from '../ui';
import { ResetCourseButton } from '../learn/EventsPaths';

export function CourseDetailPage({ id }: { id: string }) {
  const { courses, ls, pfor, pct, user, go, data, perform, busy } = useEdu();
  const c = courses.find((x) => x.id === id);
  const [draft, setDraft] = useState<{ rating: number; body: string } | null>(null);
  if (!c) return <main className="container section"><Empty title="과정을 찾을 수 없어요" description="교육 과정 목록에서 다시 선택해 주세요." /></main>;
  const items = ls(c.id), total = items.reduce((s, l) => s + l.duration, 0), pc = pct(c.id);
  const sections = items.reduce<{ name: string; lessons: typeof items }[]>((acc, l) => {
    const name = l.section || '커리큘럼';
    const last = acc[acc.length - 1];
    if (last && last.name === name) last.lessons.push(l); else acc.push({ name, lessons: [l] });
    return acc;
  }, []);
  const reviews = (data?.reviews ?? []).filter((r) => r.course_id === c.id);
  const mine = reviews.find((r) => r.user_id === user?.id);
  const started = items.some((l) => (pfor(l.id).watched || 0) > 0);
  const assignments = (data?.assignments ?? []).filter((a) => a.course_id === c.id);
  const next = items.find((l) => !pfor(l.id).complete) || items[0];
  const objectives = c.objectives.split('\n').filter(Boolean);
  const pass = data?.settings?.pass_score || '80', ratio = data?.settings?.watch_ratio || '90';
  const dist = [5, 4, 3, 2, 1].map((n) => reviews.filter((r) => r.rating === n).length);

  return (
    <main className="container section">
      <button className="back" onClick={() => go(user ? '/learn/courses' : '/courses')}><ChevronLeft size={16} /> {user ? '나의 강의실' : '교육 과정'}</button>
      <div className="course-detail">
        <div>
          <span className="pill">{c.category} · {c.level}</span>
          <h1>{c.title}</h1>
          <p>{c.description}</p>
          <div className="course-meta">
            <span><Video size={16} />{items.length}개 강의</span>
            <span><Clock size={16} />{fmtLong(total)}</span>
            <span><CheckCircle2 size={16} /> 강의별 확인 문제</span>
            {assignments.length > 0 && <span><ClipboardList size={16} />과제 {assignments.length}개</span>}
            {c.learners > 0 && <span><Users size={16} />{c.learners}명 학습</span>}
            {c.reviewCount > 0 && <span><Stars value={c.rating} size={14} /> {c.rating.toFixed(1)} ({c.reviewCount})</span>}
          </div>
          {user && pc > 0 && <ProgressBar value={pc} label="나의 진도" />}
          <div className="detail-actions">
            <Button onClick={() => go(user ? '/lesson/' + next?.id : `/login?return_to=${encodeURIComponent('/course/' + c.id)}`)}>{pc === 100 ? '다시 학습하기' : pc ? '이어서 학습하기' : '학습 시작하기'}</Button>
            {!user && items.some((l) => l.preview && l.video) && <Button secondary onClick={() => go('/lesson/' + items.find((l) => l.preview && l.video)!.id)}><Eye size={16} /> 미리보기</Button>}
          </div>
          {c.instructor && <p className="small-muted">강사 · {c.instructor}</p>}
          {user && started && <ResetCourseButton courseId={c.id} />}
        </div>
        <img src={`/images/banner-${c.image}.webp`} alt={c.title} />
      </div>

      <div className="detail-columns">
        <div>
          {objectives.length > 0 && (
            <div className="panel objectives">
              <h2><Target className="purple" size={22} /> 이 과정에서 배우는 것</h2>
              <ul>{objectives.map((o) => <li key={o}><CheckCircle2 size={17} />{o}</li>)}</ul>
            </div>
          )}
          <div className="panel">
            <h2>차근차근 배우는 커리큘럼</h2>
            <p className="muted">영상 {ratio}% 이상 시청 후 확인 문제 {pass}점 이상을 받으면 강의가 완료됩니다.</p>
            {sections.map((s, si) => (
              <div className="curriculum-section" key={s.name + si}>
                {sections.length > 1 && <h3><span>섹션 {si + 1}</span>{s.name} <small>{s.lessons.length}개 · {fmtLong(s.lessons.reduce((a, l) => a + l.duration, 0))}</small></h3>}
                {s.lessons.map((l) => {
                  const p = pfor(l.id), i = items.indexOf(l);
                  const locked = !user && !l.preview;
                  return (
                    <button key={l.id} className={'lesson-row ' + (p.complete ? 'done' : '')} onClick={() => go(locked ? `/login?return_to=${encodeURIComponent('/lesson/' + l.id)}` : '/lesson/' + l.id)}>
                      <span className="lesson-number">{String(i + 1).padStart(2, '0')}</span>
                      <div>
                        <b>{l.title}</b>
                        <span>{fmt(l.duration)} · 확인 문제 {l.questions.length}개{!l.video ? ' · 영상 등록 예정' : ''}{l.preview ? ' · 미리보기 가능' : ''}{p.watched && !p.complete ? ` · ${Math.min(100, Math.round((p.watched / l.duration) * 100))}% 시청` : ''}</span>
                      </div>
                      {p.complete ? <CheckCircle2 size={20} className="purple" /> : locked ? <Lock size={17} /> : <Play size={19} />}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
          {assignments.length > 0 && (
            <div className="panel">
              <h2><ClipboardList className="purple" size={22} /> 실습 과제</h2>
              {assignments.map((a) => <div className="assignment-row" key={a.id}><div><b>{a.title}</b>{a.due && <small>마감 {fmtShort(a.due)}</small>}</div>{user && <Button small secondary onClick={() => go('/learn/assignments')}>과제 보기</Button>}</div>)}
            </div>
          )}
          <div className="panel reviews">
            <div className="section-heading">
              <div><h2>수강 후기</h2><p className="muted">{reviews.length ? `${reviews.length}개의 후기 · 평균 ${c.rating.toFixed(1)}점` : '첫 후기를 남겨보세요.'}</p></div>
              {reviews.length > 0 && <div className="rating-summary"><b>{c.rating.toFixed(1)}</b><Stars value={c.rating} /></div>}
            </div>
            {reviews.length > 0 && (
              <div className="rating-dist">{dist.map((n, i) => <div key={i}><span>{5 - i}점</span><div className="progress-track small"><i style={{ width: (n / reviews.length) * 100 + '%' }} /></div><small>{n}</small></div>)}</div>
            )}
            {user && started && (
              draft ? (
                <form className="review-form" onSubmit={async (e) => { e.preventDefault(); const r = await perform('review', { courseId: c.id, ...draft }, '후기를 남겼습니다. 감사합니다!'); if (r) setDraft(null); }}>
                  <Stars value={draft.rating} size={24} onChange={(v) => setDraft({ ...draft, rating: v })} />
                  <textarea rows={3} maxLength={1000} value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} placeholder="과정에서 도움이 된 점, 아쉬운 점을 솔직하게 남겨주세요." />
                  <div className="between"><Button small secondary onClick={() => setDraft(null)}>취소</Button><Button small type="submit" disabled={busy || !draft.rating}>{mine ? '후기 수정' : '후기 등록'}</Button></div>
                </form>
              ) : (
                <div className="between"><Button small secondary onClick={() => setDraft({ rating: mine?.rating || 5, body: mine?.body || '' })}>{mine ? '내 후기 수정' : '후기 작성'}</Button>{mine && <button className="text-link" onClick={() => perform('review', { courseId: c.id, rating: 5, remove: true }, '후기를 삭제했습니다.')}>삭제</button>}</div>
              )
            )}
            {reviews.slice(0, 20).map((r) => (
              <div className="review-item" key={r.user_id}>
                <CharacterAvatar index={r.avatar} />
                <div><div className="between"><b>{r.name}</b><small>{fmtShort(r.created)}</small></div><Stars value={r.rating} size={13} />{r.body && <p>{r.body}</p>}</div>
              </div>
            ))}
          </div>
        </div>
        <aside className="panel detail-aside">
          <Trophy className="purple" size={30} />
          <h3>이 과정을 마치면</h3>
          <p>방송 준비와 판매의 핵심을 이해하고 나의 첫 라이브에 적용할 수 있습니다.</p>
          <ul>
            <li>핵심 개념을 영상으로 이해하기</li>
            <li>확인 문제로 배운 내용 점검하기</li>
            <li>체크리스트·과제로 실전에 적용하기</li>
            <li>전체 과정 완료 후 수료증 받기</li>
          </ul>
          <Pill>영상 {ratio}% + 퀴즈 {pass}점 이상</Pill>
          {pc === 100 && <Button small onClick={() => go('/learn/certificates')}>수료증 보기</Button>}
        </aside>
      </div>
    </main>
  );
}
