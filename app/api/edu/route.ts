import { seed, first, all, HttpError, bumpVersion, dataVersion, background } from '../../../lib/server/db';
import { out, sameOrigin } from '../../../lib/server/http';
import { current, isStaff, isDemo } from '../../../lib/server/auth';
import { getSettings, setSetting } from '../../../lib/server/settings';
import { maybeMaintain } from '../../../lib/server/maintenance';
import { buildPayload } from '../../../lib/server/payload';
import type { Ctx, Handler } from '../../../lib/server/handlers/types';
import * as auth from '../../../lib/server/handlers/auth';
import * as learning from '../../../lib/server/handlers/learning';
import * as community from '../../../lib/server/handlers/community';
import * as admin from '../../../lib/server/handlers/admin';
import { ai } from '../../../lib/server/handlers/ai';

export const dynamic = 'force-dynamic';

/** 액션 → (권한, 핸들러). 'public' | 'user' | 'admin' */
const ACTIONS: Record<string, ['public' | 'user' | 'staff' | 'admin', Handler]> = {
  demo: ['public', auth.demo as Handler],
  register: ['public', auth.register as Handler],
  login: ['public', auth.login as Handler],
  forgot: ['public', auth.forgot as Handler],
  reset: ['public', auth.resetPassword as Handler],
  login_mfa: ['public', auth.loginMfa as Handler],
  verify_email: ['public', auth.verifyEmail as Handler],

  logout: ['user', auth.logout as Handler],
  profile: ['user', auth.profile as Handler],
  preferences: ['user', auth.preferences as Handler],
  password: ['user', auth.password as Handler],
  withdraw: ['user', auth.withdraw as Handler],
  signoutOthers: ['user', auth.signoutOthers as Handler],
  notif_read: ['user', auth.notifRead as Handler],
  verify_send: ['user', auth.verifySend as Handler],
  mfa_setup: ['user', auth.mfaSetup as Handler],
  mfa_enable: ['user', auth.mfaEnable as Handler],
  mfa_disable: ['user', auth.mfaDisable as Handler],
  progress: ['user', learning.progress as Handler],
  bookmark: ['user', learning.bookmark as Handler],
  note: ['user', learning.note as Handler],
  tnote: ['user', learning.tnote as Handler],
  quiz: ['user', learning.quiz as Handler],
  review: ['user', learning.review as Handler],
  submit: ['user', learning.submit as Handler],
  progress_reset: ['user', learning.progressReset as Handler],
  rsvp: ['user', learning.rsvp as Handler],
  post: ['user', community.post as Handler],
  post_delete: ['user', community.postDelete as Handler],
  comment: ['user', community.comment as Handler],
  comment_delete: ['user', community.commentDelete as Handler],
  like: ['user', community.like as Handler],
  question: ['user', community.question as Handler],
  question_delete: ['user', community.questionDelete as Handler],
  vote: ['user', community.vote as Handler],
  question_edit: ['user', community.questionEdit as Handler],
  notice_read: ['user', community.noticeRead as Handler],
  notif_clear: ['user', auth.notifClear as Handler],
  channel: ['user', community.channel as Handler],
  channel_remove: ['user', community.channelRemove as Handler],
  visit: ['user', community.visit as Handler],

  // 운영 관리자(manager)와 최고 관리자(admin) 공통
  cohort: ['staff', admin.cohort as Handler],
  assign_cohort: ['staff', admin.assignCohort as Handler],
  member: ['staff', admin.member as Handler],
  memo: ['staff', admin.memo as Handler],
  nudge: ['staff', admin.nudge as Handler],
  invite: ['staff', admin.invite as Handler],
  course: ['staff', admin.course as Handler],
  course_duplicate: ['staff', admin.courseDuplicate as Handler],
  reorder: ['staff', admin.reorder as Handler],
  lesson: ['staff', admin.lesson as Handler],
  lessons_import: ['staff', admin.lessonsImport as Handler],
  reply: ['staff', admin.reply as Handler],
  question_update: ['staff', admin.questionUpdate as Handler],
  announcement: ['staff', admin.announcement as Handler],
  announcement_delete: ['staff', admin.announcementDelete as Handler],
  assignment: ['staff', admin.assignment as Handler],
  assignment_delete: ['staff', admin.assignmentDelete as Handler],
  review_submission: ['staff', admin.reviewSubmission as Handler],
  assignment_remind: ['staff', admin.assignmentRemind as Handler],
  ai: ['staff', ai as Handler],
  path: ['staff', admin.path as Handler],
  event: ['staff', admin.event as Handler],
  event_delete: ['staff', admin.eventDelete as Handler],
  event_remind: ['staff', admin.eventRemind as Handler],
  faq: ['staff', admin.faq as Handler],
  faq_delete: ['staff', admin.faqDelete as Handler],
  invite_bulk: ['staff', admin.inviteBulk as Handler],
  lesson_file_delete: ['staff', admin.lessonFileDelete as Handler],
  post_update: ['staff', community.postUpdate as Handler],
  certificate_reconcile: ['staff', admin.certificateReconcile as Handler],
  // 최고 관리자 전용 (삭제·권한·설정)
  cohort_delete: ['admin', admin.cohortDelete as Handler],
  member_delete: ['admin', admin.memberDelete as Handler],
  reset_link: ['admin', admin.resetLink as Handler],
  course_delete: ['admin', admin.courseDelete as Handler],
  lesson_delete: ['admin', admin.lessonDelete as Handler],
  settings: ['admin', admin.settings as Handler],
  path_delete: ['admin', admin.pathDelete as Handler],
  content_import: ['admin', admin.importContent as Handler],
  mfa_reset: ['admin', admin.mfaReset as Handler],
  bootstrap_admin: ['admin', admin.bootstrapAdmin as Handler],
  maintenance_run: ['admin', admin.maintenanceRun as Handler],
};

/** 체험 계정에서도 허용하는 운영진 작업 (최초 최고 관리자 지정만) */
const DEMO_ALLOWED = new Set(['bootstrap_admin']);
/** 데이터를 바꾸지 않는 작업 — 변경 스탬프를 올리지 않는다 */
// 본인 화면에만 영향을 주는 잦은 작업(시청 진도 등)도 제외 — 다른 사용자의 화면은 5분 주기 전체 동기화로 반영된다
const READ_ONLY = new Set(['ai', 'login', 'login_mfa', 'logout', 'demo', 'forgot', 'verify_send', 'mfa_setup', 'signoutOthers', 'progress', 'bookmark', 'note', 'tnote', 'visit', 'notif_read', 'notif_clear', 'notice_read', 'preferences']);

export async function GET(req: Request) {
  try {
    await seed();
    const url = new URL(req.url);
    const verify = url.searchParams.get('verify');
    if (verify) {
      const c = await learning.verifyCertificate(verify);
      return out(c ? { ok: true, certificate: c } : { ok: false, error: '수료증 번호를 찾을 수 없습니다.' }, c ? 200 : 404);
    }
    const user = await current(req);
    const settings = await getSettings();
    // 주기 작업(자동 알림·정리)은 10분에 한 번, 응답을 지연시키지 않도록 뒤에서 실행
    await background(() => maybeMaintain(settings));
    // 가벼운 변경 확인: 클라이언트 폴링용 (세션 확인 + 스탬프 1건 조회)
    if (url.searchParams.has('stamp')) return out({ stamp: await dataVersion(), user: user?.id || null });
    const postId = url.searchParams.get('post');
    if (postId) {
      if (!user) return out({ error: '로그인이 필요합니다.' }, 401);
      const post = await first<any>('SELECT posts.*, users.name, users.role AS author_role, COALESCE(user_profiles.avatar,0) AS avatar FROM posts JOIN users ON users.id=posts.user_id LEFT JOIN user_profiles ON user_profiles.user_id=users.id WHERE posts.id=?', postId);
      if (!post) return out({ error: '게시글을 찾을 수 없습니다.' }, 404);
      const comments = await all('SELECT comments.*, users.name, users.role AS author_role, COALESCE(user_profiles.avatar,0) AS avatar FROM comments JOIN users ON users.id=comments.user_id LEFT JOIN user_profiles ON user_profiles.user_id=users.id WHERE post_id=? ORDER BY created', postId);
      return out({ post, comments });
    }
    if (url.searchParams.get('export') === 'content') {
      if (user?.role !== 'admin' || isDemo(user)) return out({ error: '최고 관리자 권한이 필요합니다.' }, 403);
      return Response.json(await admin.exportContent(), { headers: { 'Content-Disposition': `attachment; filename="sellerbricks-campus-content-${new Date().toISOString().slice(0, 10)}.json"`, 'Cache-Control': 'private, no-store' } });
    }
    // 메일 링크에 쓸 사이트 주소 기억 (관리자가 직접 지정하지 않았을 때)
    if (!settings.site_origin && !/^(http:\/\/)?(localhost|127\.0\.0\.1)/.test(url.origin)) await setSetting('site_origin', url.origin).catch(() => {});
    const payload = JSON.stringify(await buildPayload(user));
    // 약한 ETag: 내용이 같으면 304 로 폴링 트래픽을 줄인다
    let h = 5381;
    for (let i = 0; i < payload.length; i++) h = ((h * 33) ^ payload.charCodeAt(i)) >>> 0;
    const tag = `W/"${h.toString(16)}-${payload.length}"`;
    if (req.headers.get('if-none-match') === tag) return new Response(null, { status: 304, headers: { ETag: tag, 'Cache-Control': 'private, no-store', Vary: 'Cookie' } });
    return new Response(payload, { status: 200, headers: { 'Content-Type': 'application/json', ETag: tag, 'Cache-Control': 'private, no-store', Vary: 'Cookie' } });
  } catch (e) {
    console.error('edu GET failed', e);
    return out({ error: '교육 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.' }, 503);
  }
}

export async function POST(req: Request) {
  try {
    if (!sameOrigin(req)) return out({ error: '요청을 확인할 수 없습니다.' }, 403);
    await seed();
    const settings = await getSettings();

    // 파일 업로드는 /api/upload (스트리밍) 로 이전
    if (req.headers.get('content-type')?.includes('multipart/form-data')) return out({ error: '파일 업로드 경로가 바뀌었습니다. 화면을 새로고침한 뒤 다시 시도해 주세요.' }, 415);

    const raw: any = await req.json().catch(() => ({}));
    const body: any = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
    const entry = ACTIONS[String(body.action)];
    if (!entry) return out({ error: '지원하지 않는 작업입니다.' }, 400);
    const [scope, handler] = entry;
    const user = await current(req);
    if (scope !== 'public' && !user) return out({ error: '로그인이 필요합니다.' }, 401);
    if (scope === 'staff' && !isStaff(user?.role)) return out({ error: '관리자 권한이 필요합니다.' }, 403);
    if (scope === 'admin' && user?.role !== 'admin') return out({ error: '최고 관리자 권한이 필요합니다.' }, 403);
    // 운영 관리자는 역할 변경 불가
    if (user?.role === 'manager' && body.action === 'member' && body.role) return out({ error: '역할 변경은 최고 관리자만 할 수 있습니다.' }, 403);
    // 공유 체험 관리자는 둘러보기 전용 — 실제 데이터를 바꾸는 운영 작업은 막는다
    if (isDemo(user) && (scope === 'staff' || scope === 'admin') && !DEMO_ALLOWED.has(String(body.action))) return out({ error: '체험 관리자 계정은 화면을 둘러보기만 할 수 있어요. 실제 운영은 최고 관리자 계정으로 로그인해 주세요.' }, 403);
    const ctx: Ctx = { req, body, user, settings };
    const res = await handler(ctx);
    if (res.status < 400 && !READ_ONLY.has(String(body.action))) await bumpVersion();
    return res;
  } catch (e) {
    if (e instanceof HttpError) return out({ error: e.message }, e.status);
    console.error('edu request failed', e);
    return out({ error: '저장하지 못했습니다. 입력 내용을 유지한 상태로 다시 시도해 주세요.' }, 500);
  }
}
