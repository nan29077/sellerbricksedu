'use client';
import { useMemo, useState } from 'react';
import { Search, ChevronRight, Sparkles } from 'lucide-react';
import { useEdu } from '../../../lib/edu-store';
import { CATEGORY_META } from '../../../lib/constants';
import { fmtLong } from '../../../lib/learning';
import { Empty, PageHead } from '../ui';
import { CourseCard } from './CourseCard';

export function CatalogPage({ learning = false }: { learning?: boolean }) {
  const { courses, lessons, ls, pct, pfor, go, data } = useEdu();
  const [category, setCategory] = useState('전체');
  const [search, setSearch] = useState('');
  const q = search.trim();

  const matches = useMemo(() => courses.filter((c) => !q || c.title.includes(q) || c.description.includes(q) || c.category.includes(q) || ls(c.id).some((l) => l.title.includes(q) || l.section.includes(q))), [courses, q, ls]);
  const counts = useMemo(() => Object.fromEntries(CATEGORY_META.map((m) => [m.name, matches.filter((c) => c.category === m.name).length])), [matches]);
  const groups = CATEGORY_META.map((m) => ({ ...m, items: matches.filter((c) => c.category === m.name).sort((a, b) => a.position - b.position) })).filter((g) => g.items.length);
  const shown = category === '전체' ? groups : groups.filter((g) => g.name === category);
  const total = matches.length;

  // 학습 중 요약 (교육생)
  const inProgress = learning ? courses.filter((c) => { const p = pct(c.id); return p > 0 && p < 100; }) : [];
  const certs = data?.certificates ?? [];
  const nextCourse = learning ? [...courses].sort((a, b) => a.position - b.position).find((c) => pct(c.id) === 0 && !certs.some((x) => x.course_id === c.id)) : undefined;

  return (
    <main className={learning ? '' : 'container catalog section'}>
      <PageHead title={learning ? '나의 강의실' : '셀러 성장 교육 과정'} sub={learning ? `입문부터 법규·안전까지 ${courses.length}개 과정 · ${lessons.length}개 강의. 필요한 주제부터 나의 속도로 학습하세요.` : `첫 방송을 준비하는 순간부터 꾸준히 성장하는 셀러가 되기까지, ${courses.length}개 과정 ${lessons.length}개 강의.`} />
      {learning && (inProgress.length > 0 || nextCourse) && (
        <div className="catalog-summary">
          {inProgress.length > 0 && <div className="panel"><span className="eyebrow">학습 중</span><h3>{inProgress.length}개 과정 진행 중</h3><div className="summary-list">{inProgress.slice(0, 3).map((c) => { const next = ls(c.id).find((l) => !pfor(l.id).complete); return <button key={c.id} onClick={() => go(next ? '/lesson/' + next.id : '/course/' + c.id)}><b>{c.title}</b><span>{pct(c.id)}%</span><ChevronRight size={15} /></button>; })}</div></div>}
          {nextCourse && <div className="panel purple-panel compact"><Sparkles size={22} /><span className="eyebrow">다음 추천 과정</span><h3>{nextCourse.title}</h3><p>{nextCourse.description}</p><button className="button secondary small" onClick={() => go('/course/' + nextCourse.id)}>과정 보기</button></div>}
        </div>
      )}
      <div className="filter-row">
        <div className="tabs category-tabs" role="tablist">
          <button role="tab" aria-selected={category === '전체'} className={category === '전체' ? 'selected' : ''} onClick={() => setCategory('전체')}>전체 <small>{total}</small></button>
          {CATEGORY_META.map((m) => (
            <button key={m.name} role="tab" aria-selected={category === m.name} className={category === m.name ? 'selected' : ''} onClick={() => setCategory(m.name)} disabled={!counts[m.name] && !!q}>{m.name} <small>{counts[m.name] || 0}</small></button>
          ))}
        </div>
        <div className="search"><Search size={18} /><input aria-label="교육 과정 검색" placeholder="과정·강의·주제 검색" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
      </div>
      {shown.length ? shown.map((g) => {
        const gl = g.items.flatMap((c) => ls(c.id));
        return (
          <section className="catalog-group" key={g.name}>
            <div className="catalog-group-head">
              <div><span className="eyebrow">{g.name}</span><h2>{g.desc}</h2></div>
              <small>{g.items.length}개 과정 · {gl.length}강 · {fmtLong(gl.reduce((s, l) => s + l.duration, 0))}{learning && ` · 완료 ${gl.filter((l) => pfor(l.id).complete).length}강`}</small>
            </div>
            <div className={'course-grid ' + (learning ? 'portal-courses' : '')}>{g.items.map((c) => <CourseCard key={c.id} course={c} learning={learning} />)}</div>
          </section>
        );
      }) : <Empty title="조건에 맞는 과정이 없어요" description="다른 키워드나 카테고리를 선택해 주세요." />}
    </main>
  );
}
