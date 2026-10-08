'use client';
import { useState } from 'react';
import { Plus, Upload, Trash2, Sparkles, Copy } from 'lucide-react';
import { useEdu } from '../../../lib/edu-store';
import { CATEGORIES, LEVELS, PLATFORMS, platformName, fmt } from '../../../lib/learning';
import { Button, Modal, Pill } from '../ui';

const TITLES: Record<string, string> = { course: '교육 과정 편집', lesson: '영상 강의와 확인 문제', reply: '질문 답변', cohort: '교육 기수 편집', channel: '나의 SNS 채널', progress: '학습 현황', announcement: '공지 작성', assignment: '과제 편집', review_submission: '과제 검토', import: '강의 일괄 등록', invite: '교육생 직접 등록', ai: 'AI로 확인 문제 생성' };

export function EduModals() {
  const { modal, setModal, editor, setEditor, perform, busy, courses, lessons, data, ls, pct, setBusy, load, setToast, act, openModal } = useEdu();
  const [aiText, setAiText] = useState('');
  if (!modal) return null;
  const close = () => setModal(null);
  const set = (k: string, v: any) => setEditor({ ...editor, [k]: v });
  const wide = ['lesson', 'progress', 'import', 'announcement', 'assignment'].includes(modal.type);
  const title = modal.type === 'progress' ? `${modal.user?.name}님의 학습 현황` : TITLES[modal.type] || '설정';

  const actionOf: Record<string, string> = { channel: 'channel', course: 'course', lesson: 'lesson', cohort: 'cohort', reply: 'reply', announcement: 'announcement', assignment: 'assignment', review_submission: 'review_submission', import: 'lessons_import', invite: 'invite' };
  const successOf: Record<string, string> = { reply: '답변을 등록했습니다. 교육생에게 알림이 전달됩니다.', announcement: '공지를 저장했습니다.', review_submission: '검토 결과를 저장했습니다. 교육생에게 알림이 전달됩니다.', import: '강의를 일괄 등록했습니다.', invite: '교육생을 등록했습니다. 비밀번호 재설정 링크를 전달해 주세요.' };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const a = actionOf[modal!.type];
    if (!a) return;
    const r = await perform(a, { ...editor }, successOf[a] || '저장되었습니다.');
    if (r && a === 'invite' && r.userId) {
      try { const l = await act('reset_link', { userId: r.userId }); await navigator.clipboard?.writeText(l.link); setToast('교육생을 등록하고 비밀번호 설정 링크를 복사했습니다. 교육생에게 전달해 주세요.'); } catch {}
    }
  }

  // ───────── 학습 현황 상세 ─────────
  if (modal.type === 'progress') {
    const ps = modal.progress || [];
    return (
      <Modal title={title} wide onClose={close}>
        <div>
          {courses.map((c) => (
            <div key={c.id} className="progress-detail">
              <h3>{c.title} <span className="purple">{pct(c.id, ps)}%</span></h3>
              {ls(c.id).map((l) => {
                const p = ps.find((x: any) => x.lesson_id === l.id) || {};
                return <div className="report-row" key={l.id}><b>{l.title}</b><span>시청 {fmt(p.watched || 0)} / {fmt(l.duration)}</span><span>퀴즈 {p.best_score == null ? '미응시' : `최고 ${p.best_score}점 · ${p.attempts || 0}회`}</span><Pill tone={p.complete ? 'good' : p.watched ? 'warn' : ''}>{p.complete ? `완료 ${p.completed_at ? p.completed_at.slice(0, 10) : ''}` : p.watched ? '진행 중' : '학습 전'}</Pill></div>;
              })}
            </div>
          ))}
        </div>
      </Modal>
    );
  }

  // ───────── AI 퀴즈 생성 (강의 편집기에서) ─────────
  if (modal.type === 'ai') {
    return (
      <Modal title={title} onClose={close}>
        <p className="muted">강의 내용을 바탕으로 객관식 확인 문제 3개를 생성합니다. 생성 후 강의 편집 화면에서 검토·수정하세요.</p>
        <label>강의 내용<textarea rows={6} value={editor.topic} onChange={(e) => set('topic', e.target.value)} /></label>
        {!data?.hasAiKey && <div className="info-note">AI 키가 연결되지 않았습니다. 연동 설정에서 등록해 주세요.</div>}
        {aiText && <pre className="resource-text">{aiText}</pre>}
        <div className="modal-actions">
          <Button secondary onClick={close}>닫기</Button>
          <Button disabled={busy || !data?.hasAiKey} onClick={async () => { try { const r = await act('ai', { topic: editor.topic, mode: 'quiz' }); if (r.json) { openModal('lesson', { ...editor.lesson, questions: JSON.stringify(r.json, null, 2) }); setToast('확인 문제 초안을 적용했습니다. 검토 후 저장하세요.'); } else setAiText(r.text); } catch (e: any) { setToast(e.message); } }}><Sparkles size={16} /> {busy ? '생성 중…' : '문제 생성'}</Button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title={title} wide={wide} onClose={close}>
      <form onSubmit={submit}>
        {modal.type === 'course' && (
          <>
            <label>과정명<input required value={editor.title} onChange={(e) => set('title', e.target.value)} /></label>
            <label>과정 소개<textarea rows={3} value={editor.description} onChange={(e) => set('description', e.target.value)} /></label>
            <div className="form-two">
              <label>교육 단계<select value={editor.category} onChange={(e) => set('category', e.target.value)}>{CATEGORIES.slice(1).map((c) => <option key={c}>{c}</option>)}</select></label>
              <label>난이도<select value={editor.level || '입문'} onChange={(e) => set('level', e.target.value)}>{LEVELS.map((c) => <option key={c}>{c}</option>)}</select></label>
            </div>
            <div className="form-two">
              <label>표시 순서<input type="number" min="1" value={editor.position} onChange={(e) => set('position', e.target.value)} /></label>
              <label>대표 이미지<select value={editor.image} onChange={(e) => set('image', e.target.value)}><option value="1">라이브 셀러 스튜디오</option><option value="2">상품 방송 준비</option><option value="3">실전 방송 스튜디오</option></select></label>
            </div>
            <label>학습 목표 (줄바꿈으로 구분)<textarea rows={3} value={editor.objectives || ''} onChange={(e) => set('objectives', e.target.value)} placeholder="이 과정을 마치면 할 수 있는 것" /></label>
            <label>강사·운영 담당<input value={editor.instructor || ''} onChange={(e) => set('instructor', e.target.value)} placeholder="셀러브릭스 에듀 운영팀" /></label>
            <label className="check-label"><input type="checkbox" checked={!!editor.published} onChange={(e) => set('published', e.target.checked ? 1 : 0)} /><span>교육생에게 과정 공개</span></label>
          </>
        )}

        {modal.type === 'lesson' && <LessonForm editor={editor} set={set} />}

        {modal.type === 'cohort' && (
          <>
            <label>기수명<input required value={editor.name} onChange={(e) => set('name', e.target.value)} placeholder="예: 1기 · 첫 라이브 셀러" /></label>
            <div className="form-two">
              <label>교육 시작일<input type="date" value={editor.starts} onChange={(e) => set('starts', e.target.value)} /></label>
              <label>교육 종료일<input type="date" value={editor.ends} min={editor.starts || undefined} onChange={(e) => set('ends', e.target.value)} /></label>
            </div>
            <label>기수 소개<textarea rows={3} value={editor.description} onChange={(e) => set('description', e.target.value)} /></label>
            <label>운영 상태<select value={editor.status} onChange={(e) => set('status', e.target.value)}><option value="recruiting">모집 중</option><option value="active">교육 중</option><option value="completed">교육 종료</option></select></label>
          </>
        )}

        {modal.type === 'channel' && (
          <>
            <label>플랫폼<select value={editor.platform} onChange={(e) => set('platform', e.target.value)}>{PLATFORMS.map((p) => <option key={p} value={p}>{platformName[p]}</option>)}</select></label>
            <label>내 채널 주소<input type="url" required value={editor.url} onChange={(e) => set('url', e.target.value)} placeholder="https://www.youtube.com/@mychannel" /></label>
            <label>채널 소개<textarea rows={3} maxLength={300} value={editor.bio} onChange={(e) => set('bio', e.target.value)} placeholder="어떤 콘텐츠를 만드는지 소개해 주세요." /></label>
            <label className="check-label"><input type="checkbox" checked={!!editor.shared} onChange={(e) => set('shared', e.target.checked ? 1 : 0)} /><span>교육생에게 내 이름, 기수와 채널 정보를 공개합니다.</span></label>
            <p className="small-muted">언제든 비공개로 전환하거나 등록을 해제할 수 있습니다.</p>
          </>
        )}

        {modal.type === 'reply' && <label>답변 내용<textarea required rows={7} value={editor.reply} onChange={(e) => set('reply', e.target.value)} placeholder="교육생에게 전달될 답변을 작성하세요. 저장하면 알림이 전송됩니다." /></label>}

        {modal.type === 'announcement' && (
          <>
            <label>제목<input required value={editor.title} onChange={(e) => set('title', e.target.value)} /></label>
            <label>내용<textarea required rows={8} value={editor.body} onChange={(e) => set('body', e.target.value)} /></label>
            <div className="form-two">
              <label>대상<select value={editor.cohortId || ''} onChange={(e) => set('cohortId', e.target.value)}><option value="">전체 교육생</option>{(data?.cohorts ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
              <label className="check-label"><input type="checkbox" checked={!!editor.pinned} onChange={(e) => set('pinned', e.target.checked ? 1 : 0)} /><span>상단 고정</span></label>
            </div>
            {!editor.id && <label className="check-label"><input type="checkbox" checked={editor.notify !== false} onChange={(e) => set('notify', e.target.checked)} /><span>대상 교육생에게 알림 보내기</span></label>}
          </>
        )}

        {modal.type === 'assignment' && (
          <>
            <label>과제 제목<input required value={editor.title} onChange={(e) => set('title', e.target.value)} /></label>
            <label>과제 안내<textarea rows={6} value={editor.description} onChange={(e) => set('description', e.target.value)} placeholder="무엇을, 어떤 형식으로 제출해야 하는지 구체적으로 안내하세요." /></label>
            <div className="form-two">
              <label>과정<select value={editor.courseId} onChange={(e) => setEditor({ ...editor, courseId: e.target.value, lessonId: '' })}>{courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</select></label>
              <label>연관 강의 (선택)<select value={editor.lessonId || ''} onChange={(e) => set('lessonId', e.target.value)}><option value="">없음</option>{ls(editor.courseId).map((l) => <option key={l.id} value={l.id}>{l.title}</option>)}</select></label>
            </div>
            <div className="form-two">
              <label>마감일 (선택)<input type="date" value={editor.due || ''} onChange={(e) => set('due', e.target.value)} /></label>
              <label>순서<input type="number" min="1" value={editor.position} onChange={(e) => set('position', e.target.value)} /></label>
            </div>
            <label className="check-label"><input type="checkbox" checked={!!editor.published} onChange={(e) => set('published', e.target.checked ? 1 : 0)} /><span>교육생에게 공개</span></label>
          </>
        )}

        {modal.type === 'review_submission' && (
          <>
            <label>검토 결과<select value={editor.status} onChange={(e) => set('status', e.target.value)}><option value="passed">통과</option><option value="revise">보완 요청</option><option value="submitted">검토 대기로 되돌리기</option></select></label>
            <label>점수 (선택, 0~100)<input type="number" min={0} max={100} value={editor.score ?? ''} onChange={(e) => set('score', e.target.value)} /></label>
            <label>피드백<textarea rows={6} value={editor.feedback} onChange={(e) => set('feedback', e.target.value)} placeholder="잘한 점과 보완할 점을 구체적으로 적어주세요." /></label>
          </>
        )}

        {modal.type === 'import' && (
          <>
            <label>과정<select value={editor.course_id} onChange={(e) => set('course_id', e.target.value)}>{courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</select></label>
            <label>강의 목록 JSON<textarea rows={12} required value={editor.items} onChange={(e) => set('items', e.target.value)} placeholder={'[\n  {"title":"강의 제목","summary":"소개","duration":600,"section":"섹션명","video":"https://...","objectives":"목표1\\n목표2",\n   "chapters":[{"at":0,"title":"인트로"}],\n   "questions":[{"question":"...","options":["A","B"],"answer":0,"explanation":"..."}],"resource":"학습 자료"}\n]'} /></label>
            <div className="info-note">title 만 필수입니다. questions 를 생략하면 기본 확인 문제가 들어가며, 기존 강의 뒤에 순서대로 추가됩니다.</div>
          </>
        )}

        {modal.type === 'invite' && (
          <>
            <p className="muted">가입 절차 없이 교육생 계정을 바로 만듭니다. 저장 후 비밀번호 설정 링크가 복사되니 교육생에게 전달하세요.</p>
            <label>이름<input required value={editor.name} onChange={(e) => set('name', e.target.value)} /></label>
            <label>이메일<input type="email" required value={editor.email} onChange={(e) => set('email', e.target.value)} /></label>
            <label>기수 (선택)<select value={editor.cohortId || ''} onChange={(e) => set('cohortId', e.target.value)}><option value="">미배정</option>{(data?.cohorts ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
          </>
        )}

        <div className="modal-actions">
          <button type="button" className="button secondary" onClick={close}>취소</button>
          <button className="button" disabled={busy} type="submit">{busy ? '저장 중…' : '저장하기'}</button>
        </div>
      </form>
    </Modal>
  );
  void lessons; void setBusy; void load;
}

function LessonForm({ editor, set }: { editor: any; set: (k: string, v: any) => void }) {
  const { courses, ls, setBusy, load, setEditor, setToast, data, openModal } = useEdu();
  const [tab, setTab] = useState<'basic' | 'chapters' | 'quiz' | 'resource'>('basic');
  let qs: any[] = [];
  let qsError = false;
  try { qs = JSON.parse(editor.questions || '[]'); } catch { qsError = true; }
  let chapters: any[] = [];
  let chError = false;
  try { chapters = JSON.parse(editor.chapters || '[]'); } catch { chError = true; }
  const updateQ = (i: number, key: string, value: any) => set('questions', JSON.stringify(qs.map((q, j) => (j === i ? { ...q, [key]: value } : q)), null, 2));
  const updateC = (i: number, key: string, value: any) => set('chapters', JSON.stringify(chapters.map((c, j) => (j === i ? { ...c, [key]: key === 'at' ? Number(value) : value } : c)), null, 2));
  const maxMb = Number(data?.settings?.max_video_mb) || 50;
  return (
    <>
      <div className="tabs small-tabs" role="tablist">
        {([['basic', '기본 정보'], ['chapters', `챕터 (${chapters.length})`], ['quiz', `확인 문제 (${qs.length})`], ['resource', '학습 자료·대본']] as const).map(([v, n]) => <button key={v} type="button" role="tab" aria-selected={tab === v} className={tab === v ? 'selected' : ''} onClick={() => setTab(v)}>{n}</button>)}
      </div>
      <div hidden={tab !== 'basic'}>
        <div className="form-two">
          <label>교육 과정<select value={editor.course_id} onChange={(e) => set('course_id', e.target.value)}>{courses.map((c) => <option value={c.id} key={c.id}>{c.title}</option>)}</select></label>
          <label>강의 순서<input type="number" min="1" value={editor.position} onChange={(e) => set('position', e.target.value)} /></label>
        </div>
        <label>영상 제목<input required value={editor.title} onChange={(e) => set('title', e.target.value)} /></label>
        <div className="form-two">
          <label>섹션 (커리큘럼 묶음)<input list="section-list" value={editor.section || ''} onChange={(e) => set('section', e.target.value)} placeholder="예: 오리엔테이션" /><datalist id="section-list">{Array.from(new Set(ls(editor.course_id).map((l) => l.section).filter(Boolean))).map((s) => <option key={s} value={s} />)}</datalist></label>
          <label>영상 길이 (초)<input type="number" min="1" value={editor.duration} onChange={(e) => set('duration', e.target.value)} /></label>
        </div>
        <label>학습 소개<textarea rows={2} value={editor.summary} onChange={(e) => set('summary', e.target.value)} /></label>
        <label>학습 목표 (줄바꿈 구분)<textarea rows={2} value={editor.objectives || ''} onChange={(e) => set('objectives', e.target.value)} /></label>
        <label>외부 MP4 / WebM URL<input value={editor.video} onChange={(e) => set('video', e.target.value)} placeholder="https://… / 직접 재생 가능한 영상" /></label>
        <div className="upload-box">
          <Upload size={25} />
          <b>교육 영상 파일 업로드</b>
          <p>{maxMb}MB 이하 MP4·WebM. 더 큰 영상은 외부 영상 URL을 사용하세요.</p>
          {editor.id ? (
            <input type="file" accept="video/mp4,video/webm" onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              setBusy(true);
              try {
                const fd = new FormData(); fd.set('file', file); fd.set('lessonId', editor.id);
                const r = await fetch('/api/edu', { method: 'POST', body: fd }); const j: any = await r.json();
                if (!r.ok) throw Error(j.error);
                await load();
                // 영상 길이 자동 감지
                const url = URL.createObjectURL(file); const v = document.createElement('video'); v.preload = 'metadata'; v.src = url;
                v.onloadedmetadata = () => { setEditor((prev: any) => ({ ...prev, video: j.video, duration: Math.round(v.duration) || prev.duration })); URL.revokeObjectURL(url); };
                v.onerror = () => setEditor((prev: any) => ({ ...prev, video: j.video }));
                setToast('영상을 업로드했습니다. 길이와 확인 문제를 저장해 주세요.');
              } catch (err: any) { setToast(err.message); } finally { setBusy(false); }
            }} />
          ) : <small>강의를 먼저 저장하면 영상 파일을 업로드할 수 있어요.</small>}
        </div>
        <label className="check-label"><input type="checkbox" checked={!!editor.preview} onChange={(e) => set('preview', e.target.checked ? 1 : 0)} /><span>로그인 없이 미리보기 허용 (과정 소개용 공개 강의)</span></label>
      </div>
      <div hidden={tab !== 'chapters'}>
        <p className="muted">챕터는 영상 아래 목차로 표시되고 누르면 해당 시점으로 이동합니다. 시작 시각은 초 단위입니다.</p>
        {chError ? <p className="warn-text">챕터 형식을 확인해 주세요.</p> : chapters.map((c, i) => (
          <div className="chapter-editor" key={i}>
            <input type="number" min={0} value={c.at} onChange={(e) => updateC(i, 'at', e.target.value)} aria-label="시작 시각(초)" />
            <span>{fmt(Number(c.at) || 0)}</span>
            <input value={c.title} onChange={(e) => updateC(i, 'title', e.target.value)} placeholder="챕터 제목" />
            <button type="button" className="icon-button" onClick={() => set('chapters', JSON.stringify(chapters.filter((_, j) => j !== i)))} aria-label="삭제"><Trash2 size={15} /></button>
          </div>
        ))}
        <div className="admin-actions">
          <button type="button" className="button secondary small" onClick={() => set('chapters', JSON.stringify([...chapters, { at: chapters.length ? (Number(chapters[chapters.length - 1].at) || 0) + 60 : 0, title: '' }]))}><Plus size={15} /> 챕터 추가</button>
          <button type="button" className="button secondary small" onClick={() => openModal('ai', { topic: `${editor.title}\n${editor.summary}\n${editor.transcript || ''}`, mode: 'chapters', lesson: editor })} disabled={!data?.hasAiKey}><Sparkles size={15} /> AI로 챕터 나누기</button>
        </div>
      </div>
      <div hidden={tab !== 'quiz'}>
        <p className="muted">문제·보기·정답과 해설을 작성하세요. 정답은 라디오 버튼으로 선택합니다.</p>
        {qsError ? <p className="warn-text">문제 형식을 확인해 주세요.</p> : qs.map((q, i) => (
          <div className="question-editor" key={i}>
            <label>문제 {i + 1}<input required value={q.question} onChange={(e) => updateQ(i, 'question', e.target.value)} /></label>
            {q.options.map((o: string, j: number) => (
              <label key={j} className="quiz-edit-option">
                <input type="radio" name={'answer-' + i} checked={q.answer === j} onChange={() => updateQ(i, 'answer', j)} aria-label={`보기 ${j + 1} 정답`} />
                <input required value={o} placeholder={'보기 ' + (j + 1)} onChange={(e) => updateQ(i, 'options', q.options.map((x: string, k: number) => (k === j ? e.target.value : x)))} />
                {q.options.length > 2 && <button type="button" className="icon-button" onClick={() => updateQ(i, 'options', q.options.filter((_: any, k: number) => k !== j))} aria-label="보기 삭제"><Trash2 size={13} /></button>}
              </label>
            ))}
            <div className="admin-actions">
              <button type="button" className="text-link" onClick={() => updateQ(i, 'options', [...q.options, ''])}><Plus size={13} /> 보기 추가</button>
              <button type="button" className="text-link" onClick={() => set('questions', JSON.stringify([...qs.slice(0, i + 1), { ...q }, ...qs.slice(i + 1)]))}><Copy size={13} /> 복제</button>
              <button type="button" className="text-link danger-text" onClick={() => set('questions', JSON.stringify(qs.filter((_, j) => j !== i)))}><Trash2 size={13} /> 문제 삭제</button>
            </div>
            <label>정답 해설<textarea rows={2} value={q.explanation || ''} onChange={(e) => updateQ(i, 'explanation', e.target.value)} /></label>
          </div>
        ))}
        <div className="admin-actions">
          <button type="button" className="button secondary small" onClick={() => set('questions', JSON.stringify([...qs, { question: '', options: ['', ''], answer: 0, explanation: '' }]))}><Plus size={15} /> 확인 문제 추가</button>
          <button type="button" className="button secondary small" disabled={!data?.hasAiKey} onClick={() => openModal('ai', { topic: `${editor.title}\n${editor.summary}\n${editor.objectives || ''}\n${editor.transcript || ''}`, mode: 'quiz', lesson: editor })}><Sparkles size={15} /> AI로 문제 생성</button>
        </div>
      </div>
      <div hidden={tab !== 'resource'}>
        <label>학습 자료 (체크리스트·템플릿)<textarea rows={6} value={editor.resource} onChange={(e) => set('resource', e.target.value)} /></label>
        <label>강의 대본 (선택 · 교육생에게 &lsquo;대본&rsquo; 탭으로 표시)<textarea rows={8} value={editor.transcript || ''} onChange={(e) => set('transcript', e.target.value)} /></label>
      </div>
    </>
  );
}
