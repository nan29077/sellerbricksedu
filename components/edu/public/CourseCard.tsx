'use client';
import { Play, Video, Clock, ChevronRight, Users, CheckCircle2 } from 'lucide-react';
import { useEdu } from '../../../lib/edu-store';
import { fmtLong } from '../../../lib/learning';
import type { Course } from '../../../lib/types';
import { Button, ProgressBar, Stars } from '../ui';

export function CourseCard({ course: c, learning = false }: { course: Course; learning?: boolean }) {
  const { go, ls, pct, pfor, data } = useEdu();
  const items = ls(c.id), count = items.length, pc = pct(c.id);
  const total = items.reduce((s, l) => s + l.duration, 0);
  const next = items.find((l) => !pfor(l.id).complete) || items[0];
  const cert = (data?.certificates ?? []).find((x) => x.course_id === c.id);
  const newAfterCert = cert ? items.filter((l) => !pfor(l.id).complete).length : 0;
  return (
    <article className="course-card">
      <button className="course-image" onClick={() => go(`/course/${c.id}`)} aria-label={c.title}>
        <img src={`/images/banner-${c.image}.webp`} alt="" loading="lazy" />
        <span className="image-tag">{c.category}</span>
        <span className="level-tag">{c.level}</span>
        <span className="image-play"><Play size={19} fill="currentColor" /></span>
        {learning && pc > 0 && <span className="image-progress"><i style={{ width: pc + '%' }} /></span>}
      </button>
      <div className="course-body">
        <span className="course-label">{c.category}{c.reviewCount > 0 && <> · <Stars value={c.rating} size={12} /> {c.rating.toFixed(1)} ({c.reviewCount})</>}</span>
        <button className="course-title" onClick={() => go(`/course/${c.id}`)}>{c.title}</button>
        <p>{c.description}</p>
        <div className="course-meta">
          <span><Video size={14} />{count}개 강의</span>
          <span><Clock size={14} />{fmtLong(total)}</span>
          {c.learners > 0 && <span><Users size={14} />{c.learners}명</span>}
        </div>
        {learning ? (
          <>
            <ProgressBar value={pc} label={cert ? <><CheckCircle2 size={13} /> 수료 완료{newAfterCert ? ` · 새 강의 ${newAfterCert}개` : ''}</> : '학습 진도'} />
            <Button small secondary onClick={() => go(next ? `/lesson/${next.id}` : `/course/${c.id}`)}>{cert && !newAfterCert ? '다시 학습하기' : newAfterCert ? '새 강의 학습하기' : pc ? '이어서 학습하기' : '학습 시작하기'}</Button>
          </>
        ) : (
          <div className="course-foot">
            <span>셀러 전용 <b>무료 교육</b></span>
            <button onClick={() => go(`/course/${c.id}`)}>과정 보기 <ChevronRight size={16} /></button>
          </div>
        )}
      </div>
    </article>
  );
}
