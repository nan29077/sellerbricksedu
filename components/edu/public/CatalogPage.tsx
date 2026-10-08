'use client';
import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { useEdu } from '../../../lib/edu-store';
import { CATEGORIES, LEVELS } from '../../../lib/learning';
import { Empty, PageHead, Tabs } from '../ui';
import { CourseCard } from './CourseCard';

type Sort = 'recommended' | 'popular' | 'rating' | 'short';

export function CatalogPage({ learning = false }: { learning?: boolean }) {
  const { courses, ls, pct } = useEdu();
  const [category, setCategory] = useState('전체');
  const [level, setLevel] = useState('전체');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<Sort>('recommended');
  const [status, setStatus] = useState<'all' | 'progress' | 'done' | 'new'>('all');

  const filtered = useMemo(() => {
    let list = courses.filter((c) =>
      (category === '전체' || c.category === category) &&
      (level === '전체' || c.level === level) &&
      (!search || c.title.includes(search) || c.description.includes(search) || ls(c.id).some((l) => l.title.includes(search))),
    );
    if (learning && status !== 'all') list = list.filter((c) => { const p = pct(c.id); return status === 'done' ? p === 100 : status === 'progress' ? p > 0 && p < 100 : p === 0; });
    const dur = (id: string) => ls(id).reduce((s, l) => s + l.duration, 0);
    return [...list].sort((a, b) => sort === 'popular' ? b.learners - a.learners : sort === 'rating' ? b.rating - a.rating : sort === 'short' ? dur(a.id) - dur(b.id) : a.position - b.position);
  }, [courses, category, level, search, sort, status, learning, ls, pct]);

  return (
    <main className={learning ? '' : 'container catalog section'}>
      <PageHead title={learning ? '나의 강의실' : '셀러 성장 교육 과정'} sub={learning ? '나에게 필요한 강의를 선택하고, 나의 속도로 학습하세요.' : '첫 방송을 준비하는 순간부터, 꾸준히 성장하는 셀러가 되기까지.'} />
      <div className="filter-row">
        <Tabs items={CATEGORIES} value={category} onChange={setCategory} />
        <div className="search"><Search size={18} /><input aria-label="교육 과정 검색" placeholder="과정·강의 검색" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
      </div>
      <div className="filter-row secondary">
        <select value={level} onChange={(e) => setLevel(e.target.value)} aria-label="난이도"><option value="전체">모든 난이도</option>{LEVELS.map((l) => <option key={l}>{l}</option>)}</select>
        {learning && (
          <select value={status} onChange={(e) => setStatus(e.target.value as any)} aria-label="학습 상태"><option value="all">모든 상태</option><option value="progress">학습 중</option><option value="new">시작 전</option><option value="done">수료 완료</option></select>
        )}
        <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="정렬"><option value="recommended">추천 순서</option><option value="popular">인기순</option><option value="rating">평점순</option><option value="short">짧은 과정부터</option></select>
        <span className="muted small-muted">{filtered.length}개 과정</span>
      </div>
      <div className={'course-grid ' + (learning ? 'portal-courses' : '')}>{filtered.map((c) => <CourseCard key={c.id} course={c} learning={learning} />)}</div>
      {!filtered.length && <Empty title="조건에 맞는 과정이 없어요" description="다른 키워드나 필터를 선택해 주세요." />}
    </main>
  );
}
