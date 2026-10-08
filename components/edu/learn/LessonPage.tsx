'use client';
import { useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Bookmark, Download, Lock, Trophy, PenLine, MessageCircle, CheckCircle2, GraduationCap, Target, Clock, ThumbsUp, Plus, Trash2, FileText, RefreshCw, Eye, EyeOff, Lightbulb } from 'lucide-react';
import { useEdu } from '../../../lib/edu-store';
import { fmt, fmtShort, relTime, downloadText } from '../../../lib/learning';
import type { Lesson } from '../../../lib/types';
import { Button, CharacterAvatar, Empty, Pill, ProgressBar, Tabs, CharacterAvatar as Avatar } from '../ui';
import { Player, type PlayerApi } from './Player';

export function LessonPage({ lesson }: { lesson: Lesson }) {
  const { user, data, go, act, perform, load, busy, pfor, ls, pct, courseOf, setToast, admin, patch } = useEdu();
  const lp = pfor(lesson.id);
  const course = courseOf(lesson);
  const items = ls(lesson.course_id);
  const index = items.findIndex((l) => l.id === lesson.id);
  const next = items[index + 1], prev = items[index - 1];
  const ratio = (Number(data?.settings?.watch_ratio) || 90) / 100, pass = Number(data?.settings?.pass_score) || 80;

  const [localWatched, setLocalWatched] = useState(lp.watched || 0);
  const [quizAnswers, setQuizAnswers] = useState<Record<number, number>>({});
  const [quizResult, setQuizResult] = useState<any>(null);
  const [note, setNote] = useState(lp.note || '');
  const [tnote, setTnote] = useState('');
  const [question, setQuestion] = useState('');
  const [qPublic, setQPublic] = useState(true);
  const [tab, setTab] = useState<'notes' | 'qa' | 'resource' | 'transcript'>('notes');
  const player = useRef<PlayerApi | null>(null);
  const pendingWatch = useRef(0);

  const watched = Math.max(localWatched, lp.watched || 0);
  const reading = !lesson.video;
  const canQuiz = reading || watched >= lesson.duration * ratio || !!lp.complete;
  const watchedPct = Math.min(100, Math.round((watched / lesson.duration) * 100));
  const myNotes = (data?.notes ?? []).filter((n) => n.lesson_id === lesson.id);
  const lessonQa = useMemo(() => (data?.messages ?? []).filter((m) => m.lesson_id === lesson.id).sort((a, b) => b.pinned - a.pinned || b.votes - a.votes || b.created.localeCompare(a.created)), [data?.messages, lesson.id]);
  const objectives = lesson.objectives.split('\n').filter(Boolean);

  async function onWatched(delta: number, position: number) {
    pendingWatch.current += delta;
    const j = await act('progress', { lessonId: lesson.id, position, delta }, true);
    if (j) {
      setLocalWatched(j.watched);
      if (j.complete && !lp.complete) load();
    }
  }
  async function submitQuiz() {
    try {
      const r = await act('quiz', { lessonId: lesson.id, answers: lesson.questions.map((_, i) => quizAnswers[i]) });
      setQuizResult(r);
      await load();
      document.getElementById('quiz-result')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch (e: any) { setToast(e.message, 'error'); }
  }

  if (!user && !lesson.preview) return <Empty title="로그인이 필요한 강의입니다" description="로그인 후 학습을 이어가세요." icon={Lock} action={<Button onClick={() => go(`/login?return_to=${encodeURIComponent('/lesson/' + lesson.id)}`)}>로그인</Button>} />;

  return (
    <div className="lesson-layout">
      <div>
        <button className="back" onClick={() => go(user ? '/learn/courses' : '/course/' + lesson.course_id)}><ChevronLeft size={16} /> {user ? '나의 강의실' : '과정으로'}</button>
        <Player
          key={lesson.id}
          lesson={lesson}
          startAt={lp.position || 0}
          nextLessonId={user ? next?.id : undefined}
          onWatched={user ? onWatched : () => {}}
          onReady={(api) => { player.current = api; }}
          onEnded={async () => { if (!user) return; await load(); setToast(canQuiz || watched >= lesson.duration * ratio ? '영상 시청을 마쳤어요. 확인 문제를 풀어보세요.' : '영상 시청을 마쳤어요.'); }}
        />
        <div className="player-caption">
          <span>{course?.title} · {index + 1} / {items.length}강{lesson.section ? ` · ${lesson.section}` : ''}</span>
          <span><Clock size={13} /> {fmt(lesson.duration)} · {watchedPct}% 시청{lp.complete ? ' · 완료' : ''}</span>
        </div>
        <div className="lesson-heading">
          <h1>{lesson.title}</h1>
          {user && <button className={'bookmark-button ' + (lp.bookmark ? 'on' : '')} onClick={() => { const on = !lp.bookmark; patch((d) => ({ ...d, progress: d.progress.some((p) => p.lesson_id === lesson.id) ? d.progress.map((p) => p.lesson_id === lesson.id ? { ...p, bookmark: on ? 1 : 0 } : p) : [...d.progress, { user_id: user.id, lesson_id: lesson.id, position: 0, watched: 0, complete: 0, score: null, bookmark: 1, note: '', updated: new Date().toISOString(), attempts: 0, best_score: null, completed_at: '' }] })); act('bookmark', { lessonId: lesson.id }, true).then((r) => { if (r) setToast(on ? '책갈피에 저장했습니다.' : '책갈피를 해제했습니다.'); }); }}><Bookmark size={18} fill={lp.bookmark ? 'currentColor' : 'none'} />{lp.bookmark ? '저장됨' : '책갈피'}</button>}
        </div>
        <p className="muted">{lesson.summary}</p>
        {objectives.length > 0 && <div className="panel objectives compact"><h3><Target size={18} className="purple" /> 학습 목표</h3><ul>{objectives.map((o) => <li key={o}><CheckCircle2 size={15} />{o}</li>)}</ul></div>}

        {user && (
          <>
            <div className="panel lesson-tabs-panel">
              <Tabs items={[['notes', `타임스탬프 노트 ${myNotes.length ? `(${myNotes.length})` : ''}`], ['qa', `강의 Q&A ${lessonQa.length ? `(${lessonQa.length})` : ''}`], ['resource', '학습 자료'], ...(lesson.transcript ? [['transcript', '대본'] as any] : [])]} value={tab} onChange={setTab} />
              {tab === 'notes' && (
                <div className="tnotes">
                  <form className="tnote-form" onSubmit={async (e) => { e.preventDefault(); if (!tnote.trim()) return; const at = player.current?.currentTime() || 0; const r = await perform('tnote', { lessonId: lesson.id, body: tnote, at }, '노트를 추가했습니다.'); if (r) setTnote(''); }}>
                    <span className="pill">현재 시점</span>
                    <input value={tnote} onChange={(e) => setTnote(e.target.value)} placeholder="지금 시점에 메모 남기기 (Enter)" maxLength={2000} />
                    <Button small type="submit" disabled={busy || !tnote.trim()}><Plus size={15} /> 추가</Button>
                  </form>
                  {myNotes.length ? (
                    <ul className="tnote-list">
                      {myNotes.map((n) => (
                        <li key={n.id}>
                          <button className="tnote-time" onClick={() => player.current?.seek(n.at)}>{fmt(n.at)}</button>
                          <p>{n.body}</p>
                          <button className="icon-button" aria-label="노트 삭제" onClick={() => perform('tnote', { lessonId: lesson.id, id: n.id, remove: true }, '노트를 삭제했습니다.')}><Trash2 size={15} /></button>
                        </li>
                      ))}
                    </ul>
                  ) : <p className="muted small-muted">영상을 보며 중요한 순간에 메모를 남기면, 시간을 눌러 바로 그 장면으로 이동할 수 있어요.</p>}
                  <div className="general-note">
                    <h3><PenLine size={18} /> 강의 노트</h3>
                    <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="나의 방송에 적용하고 싶은 내용을 정리해 보세요." rows={4} />
                    <div className="between">
                      <Button small onClick={() => perform('note', { lessonId: lesson.id, note }, '학습 노트를 저장했습니다.')} disabled={busy}>노트 저장</Button>
                      {(myNotes.length > 0 || note) && <button className="text-link" onClick={() => downloadText(`${lesson.title}-노트.md`, `# ${lesson.title}\n\n${note ? note + '\n\n' : ''}${myNotes.map((n) => `- [${fmt(n.at)}] ${n.body}`).join('\n')}`)}><Download size={14} /> 마크다운 내려받기</button>}
                    </div>
                  </div>
                </div>
              )}
              {tab === 'qa' && (
                <div className="lesson-qa">
                  <form onSubmit={async (e) => { e.preventDefault(); const r = await perform('question', { lessonId: lesson.id, body: question, isPublic: qPublic }, '질문을 남겼습니다. 답변이 오면 알림으로 알려드려요.'); if (r) setQuestion(''); }}>
                    <textarea value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="강의에 대해 궁금한 내용을 남겨주세요." rows={3} maxLength={5000} />
                    <div className="between">
                      <label className="check-label inline"><input type="checkbox" checked={qPublic} onChange={(e) => setQPublic(e.target.checked)} /><span>{qPublic ? <><Eye size={14} /> 다른 교육생에게 공개</> : <><EyeOff size={14} /> 관리자만 보기</>}</span></label>
                      <Button small type="submit" disabled={busy || !question.trim()}><MessageCircle size={15} /> 질문 등록</Button>
                    </div>
                  </form>
                  {lessonQa.length ? lessonQa.map((m) => (
                    <div className={'qa-item ' + (m.pinned ? 'pinned' : '')} key={m.id}>
                      <Avatar index={m.avatar} />
                      <div>
                        <div className="qa-meta"><b>{m.user_id === user.id ? '나' : m.name}</b><small>{relTime(m.created)}</small>{m.pinned ? <Pill tone="info">추천 질문</Pill> : null}{!m.public && <Pill>비공개</Pill>}{m.reply ? <Pill tone="good">답변 완료</Pill> : <Pill tone="warn">답변 대기</Pill>}</div>
                        <p className="note-text">{m.body}</p>
                        {m.reply && <div className="reply"><b>에듀 관리자 답변</b><p>{m.reply}</p></div>}
                        <div className="qa-actions">
                          <button className={m.voted ? 'on' : ''} onClick={() => { patch((d) => ({ ...d, messages: d.messages.map((x) => x.id === m.id ? { ...x, voted: x.voted ? 0 : 1, votes: x.votes + (x.voted ? -1 : 1) } : x) })); act('vote', { id: m.id }, true); }} aria-pressed={!!m.voted}><ThumbsUp size={14} /> 저도 궁금해요 {m.votes > 0 && m.votes}</button>
                          {(m.user_id === user.id && !m.reply || admin) && <button onClick={() => perform('question_delete', { id: m.id }, '질문을 삭제했습니다.')}><Trash2 size={14} /> 삭제</button>}
                        </div>
                      </div>
                    </div>
                  )) : <p className="muted small-muted">이 강의에 등록된 질문이 아직 없어요. 첫 질문을 남겨보세요.</p>}
                </div>
              )}
              {tab === 'resource' && (
                <div className="lesson-info">
                  <h3><FileText size={18} /> 학습 자료</h3>
                  {lesson.resource ? <pre className="resource-text">{lesson.resource}</pre> : <p className="muted">등록된 학습 자료가 없습니다.</p>}
                  {(data?.lessonFiles ?? []).filter((f) => f.lesson_id === lesson.id).length > 0 && <ul className="file-list">{(data?.lessonFiles ?? []).filter((f) => f.lesson_id === lesson.id).map((f) => <li key={f.id}><a href={'/api/media/' + f.id} target="_blank" rel="noopener noreferrer"><Download size={14} /> {f.name}</a><small>{Math.round(f.size / 1024)}KB</small></li>)}</ul>}
                  <Button secondary small onClick={() => downloadText(lesson.title + '-학습자료.txt', lesson.resource || '학습 자료가 아직 등록되지 않았습니다.')}><Download size={16} /> 학습 자료 받기</Button>
                </div>
              )}
              {tab === 'transcript' && <pre className="resource-text transcript">{lesson.transcript}</pre>}
            </div>

            <div className="panel quiz-panel" id="quiz">
              <div className="section-heading">
                <div><span className="eyebrow">학습 확인</span><h2>배운 내용을 확인해 볼까요?</h2></div>
                <div className="quiz-stats">
                  <Pill>{pass}점 이상 통과</Pill>
                  {lp.attempts ? <Pill tone="info" className="attempt-pill" >{lp.attempts}회 응시 · 최고 {lp.best_score ?? lp.score}점{(data?.quizAttempts ?? []).filter((a) => a.lesson_id === lesson.id).slice(0, 5).length > 1 ? ' · 최근 ' + (data?.quizAttempts ?? []).filter((a) => a.lesson_id === lesson.id).slice(0, 5).map((a) => a.score).join('→') : ''}</Pill> : null}
                </div>
              </div>
              {reading && !lp.complete && <div className="info-note"><Lightbulb size={17} /> 영상 등록 전에는 학습 소개와 자료를 읽고 확인 문제를 통과하면 강의가 완료돼요.</div>}
              {!canQuiz && <div className="info-note"><Lock size={17} /> 영상의 {Math.round(ratio * 100)}% 이상을 시청하면 확인 문제를 풀 수 있어요. <ProgressBar value={Math.min(100, Math.round((watchedPct / (ratio * 100)) * 100))} small /></div>}
              <fieldset disabled={!canQuiz || busy}>
                {lesson.questions.map((q, i) => {
                  const r = quizResult?.results[i];
                  return (
                    <div className={'quiz-item ' + (r ? (r.correct ? 'correct' : 'wrong') : '')} key={i}>
                      <h3><span>Q{i + 1}.</span> {q.question}</h3>
                      {q.options.map((o, j) => (
                        <label key={j} className={'quiz-option ' + (quizAnswers[i] === j ? 'chosen' : '') + (r && r.answer === j ? ' answer' : '')}>
                          <input type="radio" name={`quiz-${i}`} checked={quizAnswers[i] === j} onChange={() => { setQuizAnswers({ ...quizAnswers, [i]: j }); if (quizResult) setQuizResult(null); }} />
                          <span>{o}</span>
                        </label>
                      ))}
                      {r && <div className={'quiz-feedback ' + (r.correct ? 'correct' : 'wrong')}><b>{r.correct ? '정답이에요.' : '다시 확인해 주세요.'}</b><p>{r.explanation}</p></div>}
                    </div>
                  );
                })}
                <div className="between">
                  <Button disabled={!canQuiz || busy || Object.keys(quizAnswers).length !== lesson.questions.length} onClick={submitQuiz}>{quizResult ? <><RefreshCw size={16} /> 다시 제출</> : '확인 문제 제출'}</Button>
                  {quizResult && !quizResult.passed && <button className="text-link" onClick={() => { setQuizAnswers({}); setQuizResult(null); }}>답안 지우고 재도전</button>}
                </div>
              </fieldset>
              {quizResult && (
                <div className={'quiz-total ' + (quizResult.passed ? 'pass' : '')} id="quiz-result">
                  <Trophy size={21} />
                  <b>{quizResult.score}점 · {quizResult.passed ? '학습 완료! 잘하셨어요.' : `${pass}점 이상이면 통과합니다. 해설을 보고 다시 도전해 보세요.`}</b>
                  {quizResult.passed && next && <Button small secondary onClick={() => go('/lesson/' + next.id)}>다음 강의 <ChevronRight size={15} /></Button>}
                </div>
              )}
            </div>
          </>
        )}
        {!user && <div className="panel info-note"><Lightbulb size={18} /> 미리보기 강의입니다. 로그인하면 진도 저장, 확인 문제, 노트와 Q&A를 이용할 수 있어요. <Button small onClick={() => go(`/login?return_to=${encodeURIComponent('/lesson/' + lesson.id)}`)}>로그인</Button></div>}
        <div className="between lesson-nav">
          <Button secondary onClick={() => prev && go('/lesson/' + prev.id)} disabled={!prev}><ChevronLeft size={17} /> 이전 강의</Button>
          <Button onClick={() => go(next ? '/lesson/' + next.id : '/learn/courses')}>{next ? <>다음 강의 <ChevronRight size={17} /></> : '나의 강의실'}</Button>
        </div>
      </div>
      <aside className="curriculum-sidebar">
        <div className="panel">
          <span className="eyebrow">강의 목차</span>
          <h3>{course?.title}</h3>
          {user && <ProgressBar value={pct(course?.id)} label="과정 진도" />}
          {items.map((l, i) => {
            const p = pfor(l.id);
            const showSection = l.section && (i === 0 || items[i - 1].section !== l.section);
            return (
              <div key={l.id}>
                {showSection && <span className="side-section">{l.section}</span>}
                <button className={'side-lesson ' + (l.id === lesson.id ? 'selected' : '') + (p.complete ? ' done' : '')} onClick={() => go('/lesson/' + l.id)} disabled={!user && !l.preview}>
                  <span>{p.complete ? <CheckCircle2 size={17} /> : !user && !l.preview ? <Lock size={14} /> : String(i + 1).padStart(2, '0')}</span>
                  <div><b>{l.title}</b><small>{fmt(l.duration)} {l.video ? '' : '· 등록 예정'}{p.watched && !p.complete ? ` · ${Math.min(100, Math.round((p.watched / l.duration) * 100))}%` : ''}</small></div>
                </button>
              </div>
            );
          })}
        </div>
        <div className="learning-tip">
          <GraduationCap size={24} />
          <h3>짧게, 꾸준하게.</h3>
          <p>하루 한 강의씩 학습하고<br />나의 라이브에 적용해 보세요.</p>
        </div>
      </aside>
    </div>
  );
}
