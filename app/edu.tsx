'use client';
import { EduProvider, useEdu } from '../lib/edu-store';
import MainIntroduction from './main-introduction';
import AccountSettings from './account-settings';
import { Button, Empty, Logo, PageHead, Toast } from '../components/edu/ui';
import { PublicLayout } from '../components/edu/shell/PublicLayout';
import { PortalLayout } from '../components/edu/shell/PortalLayout';
import { LoginPage, ResetPage } from '../components/edu/public/LoginPage';
import { CatalogPage } from '../components/edu/public/CatalogPage';
import { CourseDetailPage } from '../components/edu/public/CourseDetailPage';
import { InfoPage, VerifyPage } from '../components/edu/public/InfoPages';
import { LessonPage } from '../components/edu/learn/LessonPage';
import { Dashboard } from '../components/edu/learn/Dashboard';
import { SavedPage, AchievementsPage, CertificatesPage, QuestionsPage, NoticesPage, AssignmentsPage } from '../components/edu/learn/Pages';
import { CommunityPage } from '../components/edu/learn/Community';
import { AdminDashboard } from '../components/edu/admin/Dashboard';
import { AdminCourses, AdminLessons } from '../components/edu/admin/Courses';
import { AdminMembers, AdminActivity } from '../components/edu/admin/Members';
import { AdminCohorts, AdminAnnouncements, AdminAssignments, AdminAi, AdminSettings } from '../components/edu/admin/Pages';
import { EduModals } from '../components/edu/admin/Modals';

function Router() {
  const { path, data, error, load, user, admin, superAdmin, lessons, busy, perform, go } = useEdu();
  const seg = path.split('/').filter(Boolean);

  if (error && !data) return <div className="error-page"><Logo /><h2>교육 정보를 불러오지 못했어요.</h2><p>{error}</p><Button onClick={() => load()}>다시 시도</Button></div>;
  if (!data) return <div className="loading"><Logo /><div className="spinner" /><p>셀러의 새로운 시작을 준비하고 있어요.</p></div>;

  // ── 공개 화면 ──
  if (seg[0] === 'reset' && seg[1]) return <PublicLayout><ResetPage token={seg[1]} /></PublicLayout>;
  if (seg[0] === 'verify') return <PublicLayout><VerifyPage code={seg[1]} /></PublicLayout>;
  if (path === '/courses') return <PublicLayout><CatalogPage /></PublicLayout>;
  if (seg[0] === 'course' && seg[1]) return <PublicLayout><CourseDetailPage id={decodeURIComponent(seg[1])} /></PublicLayout>;
  if (path === '/guide' || path === '/notices' || path === '/faq') return <PublicLayout><InfoPage kind={seg[0] as any} /></PublicLayout>;

  const lesson = seg[0] === 'lesson' ? lessons.find((l) => l.id === decodeURIComponent(seg[1] || '')) : undefined;
  const protectedPath = seg[0] === 'learn' || seg[0] === 'admin' || seg[0] === 'lesson';

  // 비로그인 미리보기 강의
  if (seg[0] === 'lesson' && !user) {
    if (lesson?.preview) return <PublicLayout><main className="container section"><LessonPage key={lesson.id} lesson={lesson} /></main></PublicLayout>;
    return <PublicLayout><LoginPage redirectTo={path} /></PublicLayout>;
  }
  if (path === '/login' || (protectedPath && !user)) return <PublicLayout><LoginPage redirectTo={protectedPath ? path : undefined} /></PublicLayout>;

  // ── 로그인 포털 ──
  if (protectedPath && user) {
    let body: React.ReactNode;
    const p = path;
    if (seg[0] === 'admin' && !admin) body = <Empty title="관리자 전용 화면입니다" description="나의 강의실에서 학습을 이어가세요." />;
    else if (seg[0] === 'lesson') body = lesson ? <LessonPage key={lesson.id} lesson={lesson} /> : <Empty title="강의를 찾을 수 없어요" description="나의 강의실에서 다시 선택해 주세요." />;
    else if (p === '/learn') body = <Dashboard />;
    else if (p === '/learn/courses') body = <CatalogPage learning />;
    else if (p === '/learn/bookmarks') body = <SavedPage kind="bookmarks" />;
    else if (p === '/learn/notes') body = <SavedPage kind="notes" />;
    else if (p === '/learn/achievements') body = <AchievementsPage />;
    else if (p === '/learn/certificates') body = <CertificatesPage />;
    else if (p === '/learn/assignments') body = <AssignmentsPage />;
    else if (p === '/learn/notices') body = <NoticesPage />;
    else if (p === '/learn/questions' || p === '/admin/questions') body = <QuestionsPage />;
    else if (p === '/learn/community' || p === '/admin/community') body = <CommunityPage />;
    else if (['/learn/profile', '/admin/profile', '/learn/settings', '/admin/account-settings'].includes(p)) body = <><PageHead title="계정 설정" sub="프로필과 계정 보안을 한곳에서 관리하세요." /><AccountSettings key={user.id} user={user} busy={busy} save={perform} /></>;
    else if (p === '/admin') body = <AdminDashboard />;
    else if (p === '/admin/courses') body = <AdminCourses />;
    else if (p.startsWith('/admin/videos')) body = <AdminLessons />;
    else if (p.startsWith('/admin/members')) body = <AdminMembers key={p} />;
    else if (p === '/admin/activity') body = <AdminActivity />;
    else if (p === '/admin/progress') body = <AdminMembers report />;
    else if (p === '/admin/cohorts') body = <AdminCohorts />;
    else if (p === '/admin/announcements') body = <AdminAnnouncements />;
    else if (p === '/admin/assignments') body = <AdminAssignments />;
    else if (p === '/admin/ai') body = <AdminAi />;
    else if (p === '/admin/settings') body = superAdmin ? <AdminSettings /> : <Empty title="최고 관리자 전용 화면입니다" description="연동 설정은 최고 관리자만 변경할 수 있어요." />;
    else body = <Empty title="화면을 찾을 수 없어요" description="왼쪽 메뉴에서 필요한 기능을 선택해 주세요." />;
    return <PortalLayout>{body}</PortalLayout>;
  }

  return <PublicLayout><main className="container section"><Empty title="페이지를 찾을 수 없어요" description="주소를 확인하거나 홈으로 이동해 주세요." action={<Button onClick={() => go('/')}>홈으로</Button>} /></main></PublicLayout>;
}

function Home() {
  const { go } = useEdu();
  return <MainIntroduction go={go} />;
}

export default function Edu() {
  return (
    <EduProvider>
      <RouterWithHome />
      <Toast />
      <EduModals />
    </EduProvider>
  );
}

function RouterWithHome() {
  const { path, data, error } = useEdu();
  if (path === '/' && data && !error) return <PublicLayout className="introduction-page"><Home /></PublicLayout>;
  return <Router />;
}
