'use client';
import { Menu, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { useEdu } from '../../../lib/edu-store';
import { Button, Logo } from '../ui';

const NAV: [string, string][] = [['/', '에듀 홈'], ['/courses', '교육 과정'], ['/guide', '학습 가이드'], ['/notices', '공지사항']];

export function PublicHeader() {
  const { path, go, user, admin, mobile, setMobile } = useEdu();
  return (
    <header className="public-header">
      <div className="container header-inner">
        <button onClick={() => go('/')} aria-label="홈"><Logo /></button>
        <nav>
          {NAV.map(([p, n]) => (
            <button key={p} className={path === p || (p !== '/' && path.startsWith(p)) ? 'active' : ''} onClick={() => go(p)}>{n}</button>
          ))}
        </nav>
        <div className="header-actions">
          <button onClick={() => go(user ? (admin ? '/admin' : '/learn') : '/login')}>{user ? '나의 대시보드' : '로그인'}</button>
          <Button small onClick={() => go(user ? '/learn/courses' : '/login?mode=register')}>{user ? '나의 강의실' : '무료로 시작하기'}</Button>
        </div>
        <button className="mobile-menu" onClick={() => setMobile(!mobile)} aria-label="메뉴">{mobile ? <X /> : <Menu />}</button>
      </div>
      {mobile && (
        <div className="mobile-public-nav">
          {[...NAV, [user ? (admin ? '/admin' : '/learn') : '/login', user ? '나의 대시보드' : '로그인'] as [string, string]].map(([p, n]) => (
            <button key={p} onClick={() => go(p)}>{n}</button>
          ))}
        </div>
      )}
    </header>
  );
}

export function Footer() {
  const { go } = useEdu();
  return (
    <footer className="site-footer">
      <div className="container footer-inner">
        <div>
          <Logo />
          <p>라이브 커머스 셀러의 시작과 성장을 함께합니다.</p>
          <small>© 2026 Sellerbricks Edu. All rights reserved.</small>
        </div>
        <div>
          <b>셀러 학습 지원</b>
          <button onClick={() => go('/guide')}>이용 가이드</button>
          <button onClick={() => go('/notices')}>공지사항</button>
          <button onClick={() => go('/faq')}>자주 묻는 질문</button>
          <button onClick={() => go('/verify')}>수료증 확인</button>
        </div>
        <div>
          <b>Sellerbricks Academy</b>
          <p>신규 셀러 온보딩 · 실전 판매 교육<br />나의 속도로 배우는 셀러 성장 과정</p>
        </div>
      </div>
    </footer>
  );
}

export function PublicLayout({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <PublicHeader />
      {children}
      <Footer />
    </div>
  );
}
