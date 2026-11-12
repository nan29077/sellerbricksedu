'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { GraduationCap, BookOpen, Bookmark, LayoutDashboard, Users, Video, Settings, LogOut, ChevronRight, Menu, Bell, MessageCircle, PenLine, Sparkles, BarChart3, Trophy, Layers, Megaphone, ClipboardList, Award, Search, X, Activity, Route, CalendarDays, MessagesSquare, HelpCircle, type LucideIcon } from 'lucide-react';
import { useEdu } from '../../../lib/edu-store';
import { relTime } from '../../../lib/learning';
import { CharacterAvatar, Logo } from '../ui';
import { SiteBanner } from './SiteBanner';
import { ROLES } from '../../../lib/constants';

type MenuItem = [string, string, LucideIcon, string?];
type MenuGroup = [string, MenuItem[]];
const MENU_STUDENT: MenuGroup[] = [
  ['학습', [
    ['/learn', '학습 대시보드', LayoutDashboard],
    ['/learn/courses', '나의 강의실', BookOpen],
    ['/learn/paths', '학습 경로', Route],
    ['/learn/events', '라이브 세션·일정', CalendarDays, 'events'],
    ['/learn/assignments', '과제', ClipboardList, 'revise'],
  ]],
  ['나의 기록', [
    ['/learn/bookmarks', '책갈피', Bookmark, 'bookmarks'],
    ['/learn/notes', '학습 노트', PenLine],
    ['/learn/achievements', '학습 기록·배지', Award],
    ['/learn/certificates', '수료증', Trophy],
  ]],
  ['소통', [
    ['/learn/questions', '학습 Q&A', MessageCircle],
    ['/learn/notices', '공지사항', Megaphone, 'notices'],
    ['/learn/notifications', '알림', Bell, 'unread'],
    ['/learn/lounge', '셀러 라운지', MessagesSquare],
    ['/learn/community', '셀러 채널 교류', Users],
  ]],
];
const MENU_ADMIN: MenuGroup[] = [
  ['운영', [
    ['/admin', '운영 대시보드', LayoutDashboard],
    ['/admin/progress', '학습 현황', BarChart3],
    ['/admin/activity', '활동 로그', Activity],
  ]],
  ['교육 콘텐츠', [
    ['/admin/courses', '교육 과정 관리', Layers],
    ['/admin/videos', '영상·퀴즈 관리', Video],
    ['/admin/paths', '학습 경로', Route],
    ['/admin/quiz', '퀴즈 분석', BarChart3],
    ['/admin/assignments', '과제 관리', ClipboardList, 'submissions'],
    ['/admin/events', '라이브 세션·일정', CalendarDays],
    ['/admin/faqs', 'FAQ 관리', HelpCircle],
    ['/admin/ai', 'AI 제작 스튜디오', Sparkles],
  ]],
  ['교육생·소통', [
    ['/admin/members', '교육생 관리', Users, 'pending'],
    ['/admin/cohorts', '기수 관리', GraduationCap],
    ['/admin/questions', '질문 관리', MessageCircle, 'questions'],
    ['/admin/announcements', '공지 관리', Megaphone],
    ['/admin/notifications', '알림', Bell, 'unread'],
    ['/admin/lounge', '셀러 라운지', MessagesSquare],
    ['/admin/community', '셀러 채널 교류', Users],
  ]],
  ['설정', [
    ['/admin/settings', '연동 설정', Settings],
  ]],
];
/** 모바일 하단 바 */
const BOTTOM_STUDENT: MenuItem[] = [['/learn', '홈', LayoutDashboard], ['/learn/courses', '강의실', BookOpen], ['/learn/events', '일정', CalendarDays, 'events'], ['/learn/notifications', '알림', Bell, 'unread']];
const BOTTOM_ADMIN: MenuItem[] = [['/admin', '대시보드', LayoutDashboard], ['/admin/members', '교육생', Users, 'pending'], ['/admin/questions', '질문', MessageCircle, 'questions'], ['/admin/notifications', '알림', Bell, 'unread']];

function NotificationBell() {
  const { data, unread, act, go, admin } = useEdu();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const fn = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, [open]);
  const list = data?.notifications ?? [];
  return (
    <div className="notif-wrap" ref={ref}>
      <button className="bell" onClick={() => setOpen(!open)} aria-label={`알림 ${unread}개`} aria-expanded={open}>
        <Bell size={20} />
        {unread > 0 && <span className="bell-badge">{unread > 9 ? '9+' : unread}</span>}
      </button>
      {open && (
        <div className="notif-panel" role="dialog" aria-label="알림">
          <div className="notif-head">
            <b>알림</b>
            {unread > 0 && <button onClick={() => act('notif_read', { all: true })}>모두 읽음</button>}
            {list.some((n) => n.read) && <button onClick={() => act('notif_clear')}>읽은 알림 지우기</button>}
            <button onClick={() => { setOpen(false); go(admin ? '/admin/notifications' : '/learn/notifications'); }}>전체 보기·설정</button>
            <button onClick={() => setOpen(false)} aria-label="닫기"><X size={16} /></button>
          </div>
          {list.length ? (
            <ul>
              {list.slice(0, 30).map((n) => (
                <li key={n.id} className={n.read ? '' : 'unread'}>
                  <button onClick={async () => { setOpen(false); if (!n.read) await act('notif_read', { id: n.id }); if (n.link) go(n.link); }}>
                    <b>{n.title}</b>
                    {n.body && <p>{n.body}</p>}
                    <small>{relTime(n.created)}</small>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted notif-empty">새 알림이 없어요.</p>
          )}
        </div>
      )}
    </div>
  );
}

export function PortalLayout({ children }: { children: ReactNode }) {
  const { path, go, user, admin, superAdmin, data, mobile, setMobile, act, setToast, progress, refreshing } = useEdu();
  const [search, setSearch] = useState('');
  const [nowMs] = useState(() => Date.now());
  const searchRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName) && !t.isContentEditable) { e.preventDefault(); searchRef.current?.focus(); }
    };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, []);
  if (!user || !data) return null;
  const counts: Record<string, number> = {
    bookmarks: progress.filter((p) => p.bookmark).length,
    notices: data.announcements.filter((a) => !a.read && new Date(a.created).getTime() > nowMs - 30 * 86400000).length,
    revise: (data.submissions ?? []).filter((s) => s.status === 'revise' && s.user_id === user.id).length,
    events: (data.events ?? []).filter((e) => new Date(e.starts).getTime() > nowMs && new Date(e.starts).getTime() - nowMs < 7 * 86400000).length,
    submissions: (data.submissions ?? []).filter((s) => s.status === 'submitted').length,
    pending: (data.users ?? []).filter((u) => u.status === 'pending').length,
    questions: data.messages.filter((m) => !m.reply).length,
    unread: (data.notifications ?? []).filter((n) => !n.read).length,
  };
  const groups: MenuGroup[] = admin ? MENU_ADMIN.map(([g, items]) => [g, items.filter(([p]) => superAdmin || p !== '/admin/settings')] as MenuGroup).filter(([, items]) => items.length) : MENU_STUDENT;
  const isSel = (p: string) => path === p || (p !== '/learn' && p !== '/admin' && path.startsWith(p + '/')) || (p !== '/learn' && p !== '/admin' && path === p);
  const q = search.trim().toLowerCase();
  const has = (s: string | undefined) => (s || '').toLowerCase().includes(q);
  /** 검색에서 과정을 고르면 포털 안에서 이어서 학습할 강의로 */
  const nextLessonPath = (cid: string) => {
    const next = data.lessons.filter((l) => l.course_id === cid).sort((a, b) => a.position - b.position).find((l) => !progress.some((p) => p.lesson_id === l.id && p.complete));
    return next ? '/lesson/' + next.id : '/course/' + cid;
  };
  const results: { key: string; title: string; sub: string; to: string }[] = q.length > 1 ? [
    ...data.courses.filter((c) => has(c.title) || has(c.description)).slice(0, 3).map((c) => ({ key: 'c' + c.id, title: c.title, sub: '과정 · ' + c.category, to: admin ? '/admin/videos' : nextLessonPath(c.id) })),
    ...data.lessons.filter((l) => has(l.title) || has(l.summary)).slice(0, 5).map((l) => ({ key: 'l' + l.id, title: l.title, sub: '강의 · ' + (data.courses.find((c) => c.id === l.course_id)?.title || ''), to: '/lesson/' + l.id })),
    ...(data.posts ?? []).filter((p) => has(p.title)).slice(0, 3).map((p) => ({ key: 'p' + p.id, title: p.title, sub: '라운지 · ' + p.name, to: '/learn/lounge/' + p.id })),
    ...data.events.filter((e) => has(e.title)).slice(0, 2).map((e) => ({ key: 'e' + e.id, title: e.title, sub: '일정 · ' + e.starts.slice(0, 10), to: admin ? '/admin/events' : '/learn/events' })),
    ...data.assignments.filter((a) => has(a.title)).slice(0, 2).map((a) => ({ key: 's' + a.id, title: a.title, sub: '과제', to: admin ? '/admin/assignments' : '/learn/assignments' })),
    ...(data.faqs ?? []).filter((f) => has(f.question) || has(f.answer)).slice(0, 2).map((f) => ({ key: 'f' + f.id, title: f.question, sub: 'FAQ', to: '/faq' })),
    ...data.announcements.filter((a) => has(a.title)).slice(0, 2).map((a) => ({ key: 'a' + a.id, title: a.title, sub: '공지', to: admin ? '/admin/announcements' : '/learn/notices' })),
  ] : [];
  return (
    <div className="portal">
      <aside className={'sidebar ' + (mobile ? 'open' : '')}>
        <button className="sidebar-logo" onClick={() => go('/')}><Logo /></button>
        <nav aria-label="주 메뉴">
          {groups.map(([g, items]) => (
            <div className="nav-group" key={g}>
              <span className="nav-group-label">{g}</span>
              {items.map(([p, n, Icon, badge]) => (
                <button key={p} className={isSel(p) ? 'selected' : ''} aria-current={isSel(p) ? 'page' : undefined} onClick={() => go(p)}>
                  <Icon size={20} />{n}
                  {badge && counts[badge] > 0 && <small>{counts[badge]}</small>}
                </button>
              ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-support">
          <GraduationCap size={25} />
          <b>{admin ? '성장의 시작을 설계하세요.' : '나의 첫 라이브, 차근차근.'}</b>
          <p>{admin ? '교육 과정부터 학습 현황까지.' : '짧은 배움이 큰 자신감으로.'}</p>
          <button onClick={() => go('/guide')}>캠퍼스 학습 가이드 <ChevronRight size={15} /></button>
        </div>
        <div className="sidebar-bottom">
          <button className="sidebar-utility" onClick={() => go('/')}><BookOpen size={17} /> 메인으로</button>
          <button className={'sidebar-utility ' + (path.endsWith('/settings') || path.endsWith('/account-settings') ? 'selected' : '')} onClick={() => go(admin ? '/admin/account-settings' : '/learn/settings')}><Settings size={17} /> 설정</button>
          <button className="profile-button" onClick={() => go(admin ? '/admin/profile' : '/learn/profile')}>
            <CharacterAvatar index={user.avatar} />
            <span><b>{user.name}</b><small>{ROLES[user.role] || '셀러 교육생'}</small></span>
            <Settings size={17} />
          </button>
          <button className="logout" onClick={async () => { try { await act('logout'); location.href = '/login'; } catch (e: any) { setToast(e.message, 'error'); } }}><LogOut size={17} /> 로그아웃</button>
        </div>
      </aside>
      {mobile && <button className="sidebar-backdrop" onClick={() => setMobile(false)} aria-label="메뉴 닫기" />}
      <div className="portal-main">
        <SiteBanner />
        <header className="portal-header">
          <div>
            <button className="mobile-menu" onClick={() => setMobile(!mobile)} aria-label="메뉴 열기"><Menu size={23} /></button>
            <span>{admin ? (superAdmin ? '관리자 센터' : '운영 관리자 센터') : '나의 학습 공간'}</span>
            {refreshing && <span className="sync-dot" title="동기화 중" aria-label="동기화 중" />}
          </div>
          <div className="portal-search">
            <Search size={16} />
            <input ref={searchRef} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="검색 ( / )" aria-label="통합 검색" onKeyDown={(e) => { if (e.key === 'Escape') { setSearch(''); (e.target as HTMLInputElement).blur(); } if (e.key === 'Enter' && results[0]) { setSearch(''); go(results[0].to); } }} />
            {results.length > 0 && (
              <ul className="search-results">
                {results.map((r) => (
                  <li key={r.key}><button onClick={() => { setSearch(''); go(r.to); }}><b>{r.title}</b><small>{r.sub}</small></button></li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <button onClick={() => go('/')}><BookOpen size={16} /><span>캠퍼스 홈</span></button>
            <NotificationBell />
          </div>
        </header>
        {data.demo && admin && (
          <div className="demo-strip" role="note">
            <b>체험 관리자</b> · 화면을 둘러보는 전용 계정이라 저장·삭제는 되지 않아요. 회원 이메일은 가려서 보여드려요.
            {data.needsAdmin && <> <button className="text-link" onClick={() => go('/admin/members')}>최초 최고 관리자 지정하기</button></>}
          </div>
        )}
        <main className="portal-content">{children}</main>
        <nav className="bottom-nav" aria-label="빠른 메뉴">
          {(admin ? BOTTOM_ADMIN : BOTTOM_STUDENT).map(([p, n, Icon, badge]) => (
            <button key={p} className={path === p ? 'selected' : ''} aria-current={path === p ? 'page' : undefined} onClick={() => go(p)}>
              <Icon size={20} /><span>{n}</span>{badge && counts[badge] > 0 && <small>{counts[badge] > 9 ? '9+' : counts[badge]}</small>}
            </button>
          ))}
          <button onClick={() => setMobile(true)}><Menu size={20} /><span>전체 메뉴</span></button>
        </nav>
        <div className="portal-footer">© Sellerbricks Campus <span>배움으로 시작하는 셀러의 성장</span><span className="portal-legal"><button onClick={() => go('/terms')}>이용약관</button><button onClick={() => go('/privacy')}><b>개인정보처리방침</b></button></span></div>
      </div>
    </div>
  );
}
