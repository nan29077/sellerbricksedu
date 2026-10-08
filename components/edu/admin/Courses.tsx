'use client';
import { useState } from 'react';
import { Plus, PenLine, Copy, Trash2, GripVertical, Eye, EyeOff, Video, Search, Upload, ArrowUp, ArrowDown, Sparkles } from 'lucide-react';
import { useEdu } from '../../../lib/edu-store';
import { CATEGORIES, fmt, fmtLong } from '../../../lib/learning';
import { Button, Empty, PageHead, Pill, Tabs } from '../ui';

/** 드래그 정렬 공통 훅 */
function useDragSort(ids: string[], onCommit: (ids: string[]) => void) {
  const [drag, setDrag] = useState<string | null>(null);
  const [order, setOrder] = useState<string[] | null>(null);
  const list = order ?? ids;
  return {
    list,
    props: (id: string) => ({
      draggable: true,
      onDragStart: () => { setDrag(id); setOrder(ids); },
      onDragOver: (e: React.DragEvent) => { e.preventDefault(); if (!drag || drag === id) return; const cur = [...(order ?? ids)]; const from = cur.indexOf(drag), to = cur.indexOf(id); cur.splice(from, 1); cur.splice(to, 0, drag); setOrder(cur); },
      onDragEnd: () => { if (order && order.join() !== ids.join()) onCommit(order); setDrag(null); setOrder(null); },
    }),
    cls: (id: string) => (drag === id ? 'dragging' : ''),
    move: (id: string, dir: -1 | 1) => { const cur = [...ids]; const i = cur.indexOf(id), j = i + dir; if (j < 0 || j >= cur.length) return; [cur[i], cur[j]] = [cur[j], cur[i]]; onCommit(cur); },
  };
}

export function AdminCourses() {
  const { courses, ls, openModal, perform, ask, go, superAdmin } = useEdu();
  const sorted = [...courses].sort((a, b) => a.position - b.position);
  const dnd = useDragSort(sorted.map((c) => c.id), (ids) => perform('reorder', { table: 'courses', ids }, '과정 순서를 저장했습니다.'));
  const blank = { title: '', description: '', category: '입문', level: '입문', image: 1, position: courses.length + 1, published: 0, objectives: '', instructor: '' };
  return (
    <>
      <PageHead title="교육 과정 관리" sub="입문부터 실전까지, 셀러의 성장 흐름에 맞게 과정을 구성하세요. 카드를 끌어 순서를 바꿀 수 있어요." action={<Button small onClick={() => openModal('course', blank)}><Plus size={17} /> 과정 등록</Button>} />
      <div className="saved-grid sortable">
        {dnd.list.map((id) => courses.find((c) => c.id === id)!).filter(Boolean).map((c, i) => (
          <div className={'admin-course panel ' + dnd.cls(c.id)} key={c.id} {...dnd.props(c.id)}>
            <div className="drag-handle" aria-hidden="true"><GripVertical size={16} /></div>
            <img src={`/images/banner-${c.image}.webp`} alt="" />
            <div className="between"><span className="course-label">{c.category} · {c.level} · 순서 {i + 1}</span><Pill tone={c.published ? 'good' : ''}>{c.published ? '공개 중' : '비공개'}</Pill></div>
            <h3>{c.title}</h3>
            <p className="muted">{c.description}</p>
            <div className="course-meta"><span><Video size={13} />{ls(c.id).length}개 강의</span><span>{fmtLong(ls(c.id).reduce((s, l) => s + l.duration, 0))}</span><span>{c.learners}명 시청</span>{c.reviewCount > 0 && <span>★ {c.rating.toFixed(1)}</span>}</div>
            <div className="admin-actions">
              <Button secondary small onClick={() => openModal('course', c)}><PenLine size={14} /> 편집</Button>
              <Button secondary small onClick={() => perform('course', { ...c, published: c.published ? 0 : 1 }, c.published ? '과정을 비공개로 전환했습니다.' : '과정을 공개했습니다.')}>{c.published ? <><EyeOff size={14} /> 비공개</> : <><Eye size={14} /> 공개</>}</Button>
              <Button secondary small onClick={() => go('/admin/videos?course=' + c.id)}><Video size={14} /> 강의</Button>
              <Button secondary small onClick={() => perform('course_duplicate', { id: c.id }, '과정을 복제했습니다. 비공개 상태로 추가되었어요.')} title="복제"><Copy size={14} /></Button>
              {superAdmin && <Button secondary small danger onClick={async () => { if (await ask(`'${c.title}' 과정을 삭제할까요?`, `강의 ${ls(c.id).length}개와 교육생 진도, 후기, 과제가 함께 삭제되며 복구할 수 없습니다.`, { danger: true, confirmLabel: '삭제' })) perform('course_delete', { id: c.id }, '과정을 삭제했습니다.'); }} title="삭제"><Trash2 size={14} /></Button>}
              <span className="order-buttons"><button onClick={() => dnd.move(c.id, -1)} aria-label="위로" disabled={i === 0}><ArrowUp size={14} /></button><button onClick={() => dnd.move(c.id, 1)} aria-label="아래로" disabled={i === dnd.list.length - 1}><ArrowDown size={14} /></button></span>
            </div>
          </div>
        ))}
      </div>
      {!courses.length && <Empty title="첫 교육 과정을 만들어 보세요" description="과정을 등록한 뒤 영상·퀴즈 관리에서 강의를 추가하세요." />}
    </>
  );
}

export function AdminLessons() {
  const { courses, lessons, ls, openModal } = useEdu();
  const params = typeof location !== 'undefined' ? new URLSearchParams(location.search) : null;
  const [courseId, setCourseId] = useState(params?.get('course') || 'all');
  const [category, setCategory] = useState('전체');
  const [search, setSearch] = useState('');
  const [onlyMissing, setOnlyMissing] = useState(false);
  const visibleCourses = courses.filter((c) => (courseId === 'all' || c.id === courseId) && (category === '전체' || c.category === category));
  const blankLesson = (cid?: string) => ({ course_id: cid || courses[0]?.id, title: '', summary: '', duration: 600, position: ls(cid || courses[0]?.id).length + 1, video: '', section: '', objectives: '', transcript: '', preview: 0, chapters: '[]', questions: JSON.stringify([{ question: '', options: ['', ''], answer: 0, explanation: '' }], null, 2), resource: '' });
  return (
    <>
      <PageHead title="영상·퀴즈 관리" sub="강의 영상, 챕터, 학습 자료와 확인 문제를 과정별로 관리하세요. 강의를 끌어 순서를 바꿀 수 있어요."
        action={<div className="head-actions"><Button small secondary onClick={() => openModal('import', { course_id: courseId !== 'all' ? courseId : courses[0]?.id, items: '' })}><Upload size={15} /> 일괄 등록</Button><Button small onClick={() => openModal('lesson', blankLesson(courseId !== 'all' ? courseId : undefined))}><Plus size={17} /> 강의 등록</Button></div>} />
      <div className="filter-row">
        <Tabs items={CATEGORIES} value={category} onChange={setCategory} />
        <div className="search"><Search size={17} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="강의 제목 검색" aria-label="영상 검색" /></div>
      </div>
      <div className="filter-row secondary">
        <select value={courseId} onChange={(e) => setCourseId(e.target.value)} aria-label="과정 선택"><option value="all">모든 과정</option>{courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</select>
        <label className="check-label inline"><input type="checkbox" checked={onlyMissing} onChange={(e) => setOnlyMissing(e.target.checked)} /><span>영상 미등록만</span></label>
        <span className="small-muted">{lessons.filter((l) => l.video).length} / {lessons.length}개 영상 등록됨</span>
      </div>
      {visibleCourses.map((c) => <CourseLessonList key={c.id} courseId={c.id} search={search} onlyMissing={onlyMissing} />)}
      {!visibleCourses.length && <Empty title="과정이 없어요" description="먼저 교육 과정을 등록해 주세요." />}
    </>
  );
}

function CourseLessonList({ courseId, search, onlyMissing }: { courseId: string; search: string; onlyMissing: boolean }) {
  const { courses, ls, openModal, perform, ask, data, superAdmin } = useEdu();
  const c = courses.find((x) => x.id === courseId)!;
  const items = ls(courseId);
  const dnd = useDragSort(items.map((l) => l.id), (ids) => perform('reorder', { table: 'lessons', ids }, '강의 순서를 저장했습니다.'));
  const shown = dnd.list.map((id) => items.find((l) => l.id === id)!).filter((l) => l && l.title.includes(search) && (!onlyMissing || !l.video));
  if (!shown.length && (search || onlyMissing)) return null;
  const withAnswers = (l: any) => ({ ...l, chapters: JSON.stringify(l.chapters || [], null, 2), questions: JSON.stringify(data?.questions?.find((q) => q.id === l.id)?.questions || [], null, 2) });
  return (
    <div className="panel video-list">
      <div className="section-heading"><div><span className="course-label">{c.category} · {c.level}{!c.published && ' · 비공개'}</span><h2>{c.title}</h2></div><Button small secondary onClick={() => openModal('lesson', { course_id: c.id, title: '', summary: '', duration: 600, position: items.length + 1, video: '', section: items[items.length - 1]?.section || '', objectives: '', transcript: '', preview: 0, chapters: '[]', questions: JSON.stringify([{ question: '', options: ['', ''], answer: 0, explanation: '' }], null, 2), resource: '' })}><Plus size={14} /> 이 과정에 강의 추가</Button></div>
      {shown.length ? shown.map((l, i) => (
        <div className={'video-row ' + dnd.cls(l.id)} key={l.id} {...dnd.props(l.id)}>
          <span className="drag-handle"><GripVertical size={16} /></span>
          <span className="video-row-icon"><Video size={22} /></span>
          <div>
            <span className="course-label">{i + 1}강{l.section ? ` · ${l.section}` : ''}{l.preview ? ' · 미리보기' : ''}</span>
            <h3>{l.title}</h3>
            <small>{fmt(l.duration)} · 확인 문제 {l.questions.length}개 · 챕터 {l.chapters.length}개 · {l.video ? (l.video.startsWith('/api/media/') ? '업로드 영상' : '외부 영상') : <b className="warn-text">영상 등록 예정</b>}</small>
          </div>
          <div className="admin-actions">
            <Button secondary small onClick={() => openModal('lesson', withAnswers(l))}><PenLine size={14} /> 편집</Button>
            <Button secondary small onClick={() => openModal('ai', { topic: `${c.title} - ${l.title}: ${l.summary}`, mode: 'quiz', lesson: withAnswers(l) })} title="AI로 확인 문제 생성"><Sparkles size={14} /></Button>
            {superAdmin && <Button secondary small danger onClick={async () => { if (await ask(`'${l.title}' 강의를 삭제할까요?`, '교육생의 진도와 노트가 함께 삭제됩니다.', { danger: true, confirmLabel: '삭제' })) perform('lesson_delete', { id: l.id }, '강의를 삭제했습니다.'); }} title="삭제"><Trash2 size={14} /></Button>}
            <span className="order-buttons"><button onClick={() => dnd.move(l.id, -1)} aria-label="위로" disabled={i === 0}><ArrowUp size={14} /></button><button onClick={() => dnd.move(l.id, 1)} aria-label="아래로" disabled={i === shown.length - 1}><ArrowDown size={14} /></button></span>
          </div>
        </div>
      )) : <p className="muted">등록된 강의가 없어요.</p>}
    </div>
  );
}
