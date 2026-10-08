'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { GraduationCap, BookOpen, Bookmark, LayoutDashboard, Users, Video, Settings, LogOut, ChevronRight, Menu, Bell, MessageCircle, PenLine, Sparkles, BarChart3, Trophy, Layers, Megaphone, ClipboardList, Award, Search, X, Activity, Route, CalendarDays, MessagesSquare, HelpCircle, type LucideIcon } from 'lucide-react';
import { useEdu } from '../../../lib/edu-store';
import { relTime } from '../../../lib/learning';
import { CharacterAvatar, Logo } from '../ui';
import { ROLES } from '../../../lib/constants';

type MenuItem = [string, string, LucideIcon, string?];
const MENU_STUDENT: MenuItem[] = [
  ['/learn', '학습 대시보드', LayoutDashboard],
  ['/learn/courses', '나의 강의실', BookOpen],
  ['/learn/paths', '학습 경로', Route],
  ['/learn/events', '라이브 세션·일정', CalendarDays, 'events'],
  ['/learn/assignments', '과제', ClipboardList],
  ['/learn/bookmarks', '책갈피', Bookmark, 'bookmarks'],
  ['/learn/notes', '학습 노트', PenLine],
  ['/learn/achievements', '학습 기록·배지', Award],
  ['/learn/certificates', '수료증', Trophy],
  ['/learn/questions', '학습 Q&A', MessageCircle],
  ['/learn/notices', '공지사항', Megaphone, 'notices'],
  ['/learn/lounge', '셀러 라운지', MessagesSquare],
  ['/learn/community', '셀러 채널 교류', Users],
];
const MENU_ADMIN: MenuItem[] = [
  ['/admin', '운영 대시보드', LayoutDashboard],
  ['/admin/courses', '교육 과정 관리', Layers],
  ['/admin/videos', '영상·퀴즈 관리', Video],
  ['/admin/paths', '학습 경로', Route],
  ['/admin/quiz', '퀴즈 분석', BarChart3],
  ['/admin/assignments', '과제 관리', ClipboardList, 'submissions'],
  ['/admin/events', '라이브 세션·일정', CalendarDays],
  ['/admin/members', '교육생 관리', Users, 'pending'],
  ['/admin/cohorts', '기수 관리', GraduationCap],
  ['/admin/progress', '학습 현황', BarChart3],
  ['/admin/questions', '질문 관리', MessageCircle, 'questions'],
  ['/admin/announcements', '공지 관리', Megaphone],
  ['/admin/faqs', 'FAQ 관리', HelpCircle],
  ['/admin/lounge', '셀러 라운지', MessagesSquare],
  ['/admin/activity', '활동 로그', Activity],
  ['/admin/community', '셀러 채널 교류', Users],
  ['/admin/ai', 'AI 제작 스튜디오', Sparkles],
  ['/admin/settings', '연동 설정', Settings],
];

function NotificationBell() {
  const { data, unread, act, go } = useEdu();
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
    notices: data.announcements.filter((a) => new Date(a.created).getTime() > nowMs - 7 * 86400000).length,
    events: (data.events ?? []).filter((e) => new Date(e.starts).getTime() > nowMs && new Date(e.starts).getTime() - nowMs < 7 * 86400000).length,
    submissions: (data.submissions ?? []).filter((s) => s.status === 'submitted').length,
    pending: (data.users ?? []).filter((u) => u.status === 'pending').length,
    questions: data.messages.filter((m) => !m.reply).length,
  };
  const menus = admin ? MENU_ADMIN.filter(([p]) => superAdmin || p !== '/admin/settings') : MENU_STUDENT;
  const q = search.trim();
  const results: { key: string; title: string; sub: string; to: string }[] = q.length > 1 ? [
    ...data.courses.filter((c) => c.title.includes(q)).slice(0, 3).map((c) => ({ key: 'c' + c.id, title: c.title, sub: '과정 · ' + c.category, to: '/course/' + c.id })),
    ...data.lessons.filter((l) => l.title.includes(q) || l.summary.includes(q)).slice(0, 5).map((l) => ({ key: 'l' + l.id, title: l.title, sub: '강의 · ' + (data.courses.find((c) => c.id === l.course_id)?.title || ''), to: '/lesson/' + l.id })),
    ...(data.posts ?? []).filter((p) => p.title.includes(q)).slice(0, 3).map((p) => ({ key: 'p' + p.id, title: p.title, sub: '라운지 · ' + p.name, to: '/learn/lounge/' + p.id })),
    ...data.announcements.filter((a) => a.title.includes(q)).slice(0, 2).map((a) => ({ key: 'a' + a.id, title: a.title, sub: '공지', to: admin ? '/admin/announcements' : '/learn/notices' })),
  ] : [];
  return (
    <div className="portal">
      <aside className={'sidebar ' + (mobile ? 'open' : '')}>
        <button className="sidebar-logo" onClick={() => go('/')}><Logo /></button>
        <span className="sidebar-role">{admin ? '교육 운영' : '나의 학습'}</span>
        <nav>
          {menus.map(([p, n, Icon, badge]) => (
            <button key={p} className={path === p || (p !== '/learn' && p !== '/admin' && path.startsWith(p)) ? 'selected' : ''} onClick={() => go(p)}>
              <Icon size={20} />{n}
              {badge && counts[badge] > 0 && <small>{counts[badge]}</small>}
            </button>
          ))}
        </nav>
        <div className="sidebar-support">
          <GraduationCap size={25} />
          <b>{admin ? '성장의 시작을 설계하세요.' : '나의 첫 라이브, 차근차근.'}</b>
          <p>{admin ? '교육 과정부터 학습 현황까지.' : '짧은 배움이 큰 자신감으로.'}</p>
          <button onClick={() => go('/guide')}>에듀 학습 가이드 <ChevronRight size={15} /></button>
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
            <button onClick={() => go('/')}><BookOpen size={16} /><span>에듀 홈</span></button>
            <NotificationBell />
          </div>
        </header>
        <main className="portal-content">{children}</main>
        <div className="portal-footer">© Sellerbricks Edu <span>배움으로 시작하는 셀러의 성장</span></div>
      </div>
    </div>
  );
}
