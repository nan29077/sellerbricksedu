/* eslint-disable @next/next/no-html-link-for-pages -- 검색엔진용 서버 본문은 일반 링크가 맞다 */
import type { Metadata } from 'next';
import { seed, all, first } from './db';
import { getSettings } from './settings';

/**
 * 검색엔진용 서버 렌더링 — 공개 페이지(홈·과정·FAQ·공지)의 본문과 메타데이터.
 * 화면은 클라이언트 앱이 그리고, 이 내용은 앱이 뜨기 전·자바스크립트를 실행하지 않는 수집기를 위해 HTML 에 포함된다.
 */
type Course = { id: string; title: string; description: string; category: string; level: string; objectives: string; instructor: string };

async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try { await seed(); return await fn(); } catch (e) { console.warn('seo render skipped', e); return fallback; }
}
const clip = (s: string, n = 150) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

export async function pageMetadata(path: string[]): Promise<Metadata> {
  const [a, b] = path;
  const site = await safe(async () => (await getSettings()).site_name || '셀러브릭스 캠퍼스', '셀러브릭스 캠퍼스');
  const noindex: Metadata = { robots: { index: false, follow: false } };
  if (['learn', 'admin', 'lesson', 'reset', 'verify-email', 'login'].includes(a)) return { title: `${a === 'login' ? '로그인' : '나의 학습'} | ${site}`, ...noindex };
  if (a === 'course' && b) {
    const c = await safe(() => first<Course>('SELECT * FROM courses WHERE id=? AND published=1', decodeURIComponent(b)), null);
    if (!c) return { title: `교육 과정 | ${site}` };
    const description = clip(c.description || `${c.title} — ${site} 라이브 커머스 셀러 교육`);
    return { title: `${c.title} | ${site}`, description, alternates: { canonical: `/course/${encodeURIComponent(c.id)}` }, openGraph: { title: `${c.title} | ${site}`, description, type: 'website' } };
  }
  const map: Record<string, [string, string]> = {
    courses: ['교육 과정', '입문부터 방송 준비·실전 판매·운영·정산까지, 라이브 커머스 셀러를 위한 단계별 무료 교육 과정.'],
    guide: ['학습 가이드', '셀러브릭스 캠퍼스에서 강의를 듣고, 확인 문제를 풀고, 수료증을 받는 방법을 안내합니다.'],
    notices: ['공지사항', '셀러브릭스 캠퍼스의 새 소식과 교육 일정 안내.'],
    faq: ['자주 묻는 질문', '가입·승인, 진도, 확인 문제, 수료증, 라이브 세션에 대한 자주 묻는 질문.'],
    verify: ['수료증 확인', '수료증 검증 번호로 셀러브릭스 캠퍼스 수료 여부를 확인하세요.'],
    terms: ['이용약관', ''],
    privacy: ['개인정보처리방침', ''],
  };
  const m = map[a];
  if (!m) return {};
  return { title: `${m[0]} | ${site}`, ...(m[1] ? { description: m[1], openGraph: { title: `${m[0]} | ${site}`, description: m[1] } } : {}), alternates: { canonical: '/' + a } };
}

function JsonLd({ data }: { data: unknown }) {
  // 따옴표·꺾쇠를 이스케이프해 스크립트 주입을 막는다
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }} />;
}

export async function SeoContent({ path }: { path: string[] }) {
  const [a, b] = path;
  if (!a) {
    const courses = await safe(() => all<Course>('SELECT id,title,description,category FROM courses WHERE published=1 ORDER BY position'), []);
    return (
      <section className="seo-fallback" aria-hidden="false">
        <h1>셀러브릭스 캠퍼스 — 라이브 커머스 셀러 교육</h1>
        <p>처음 시작하는 셀러를 위한 라이브 커머스 교육. 준비부터 실전까지, 나의 속도로 배우고 성장하세요.</p>
        <h2>교육 과정</h2>
        <ul>{courses.map((c) => <li key={c.id}><a href={`/course/${encodeURIComponent(c.id)}`}>{c.title}</a> — {clip(c.description, 100)}</li>)}</ul>
        <p><a href="/courses">전체 과정 보기</a> · <a href="/guide">학습 가이드</a> · <a href="/faq">자주 묻는 질문</a> · <a href="/notices">공지사항</a></p>
        <JsonLd data={{ '@context': 'https://schema.org', '@type': 'EducationalOrganization', name: '셀러브릭스 캠퍼스', description: '라이브 커머스 셀러 교육' }} />
      </section>
    );
  }
  if (a === 'courses') {
    const courses = await safe(() => all<Course>('SELECT id,title,description,category,level FROM courses WHERE published=1 ORDER BY position'), []);
    return (
      <section className="seo-fallback">
        <h1>교육 과정</h1>
        <ul>{courses.map((c) => <li key={c.id}><a href={`/course/${encodeURIComponent(c.id)}`}>{c.title}</a> ({c.category} · {c.level}) — {clip(c.description, 120)}</li>)}</ul>
        <JsonLd data={{ '@context': 'https://schema.org', '@type': 'ItemList', itemListElement: courses.map((c, i) => ({ '@type': 'ListItem', position: i + 1, url: `/course/${encodeURIComponent(c.id)}`, name: c.title })) }} />
      </section>
    );
  }
  if (a === 'course' && b) {
    const id = decodeURIComponent(b);
    const c = await safe(() => first<Course>('SELECT * FROM courses WHERE id=? AND published=1', id), null);
    if (!c) return null;
    const lessons = await safe(() => all<{ title: string; summary: string; section: string }>('SELECT title, summary, section FROM lessons WHERE course_id=? ORDER BY position', id), []);
    return (
      <section className="seo-fallback">
        <h1>{c.title}</h1>
        <p>{c.description}</p>
        {c.objectives && <><h2>학습 목표</h2><ul>{c.objectives.split('\n').filter(Boolean).map((o) => <li key={o}>{o}</li>)}</ul></>}
        <h2>커리큘럼 ({lessons.length}강)</h2>
        <ol>{lessons.map((l, i) => <li key={i}><b>{l.title}</b>{l.summary ? ` — ${clip(l.summary, 120)}` : ''}</li>)}</ol>
        <p><a href="/courses">다른 과정 보기</a></p>
        <JsonLd data={{ '@context': 'https://schema.org', '@type': 'Course', name: c.title, description: c.description, provider: { '@type': 'Organization', name: '셀러브릭스 캠퍼스' }, educationalLevel: c.level, isAccessibleForFree: true, inLanguage: 'ko' }} />
      </section>
    );
  }
  if (a === 'faq') {
    const faqs = await safe(() => all<{ question: string; answer: string }>('SELECT question, answer FROM faqs WHERE published=1 ORDER BY position'), []);
    return (
      <section className="seo-fallback">
        <h1>자주 묻는 질문</h1>
        {faqs.map((f, i) => <div key={i}><h2>{f.question}</h2><p>{f.answer}</p></div>)}
        <JsonLd data={{ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faqs.map((f) => ({ '@type': 'Question', name: f.question, acceptedAnswer: { '@type': 'Answer', text: f.answer } })) }} />
      </section>
    );
  }
  if (a === 'notices') {
    const list = await safe(() => all<{ title: string; body: string; created: string }>('SELECT title, body, created FROM announcements WHERE cohort_id IS NULL AND public=1 ORDER BY pinned DESC, created DESC LIMIT 20'), []);
    return (
      <section className="seo-fallback">
        <h1>공지사항</h1>
        {list.map((n, i) => <article key={i}><h2>{n.title}</h2><p>{clip(n.body, 300)}</p><small>{n.created.slice(0, 10)}</small></article>)}
      </section>
    );
  }
  return null;
}
