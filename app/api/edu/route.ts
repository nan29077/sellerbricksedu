import { seed, bucket, run, first, all, uid, now, HttpError } from '../../../lib/server/db';
import { out, sameOrigin } from '../../../lib/server/http';
import { current, isStaff } from '../../../lib/server/auth';
import { getSettings } from '../../../lib/server/settings';
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

  logout: ['user', auth.logout as Handler],
  profile: ['user', auth.profile as Handler],
  preferences: ['user', auth.preferences as Handler],
  password: ['user', auth.password as Handler],
  signoutOthers: ['user', auth.signoutOthers as Handler],
  notif_read: ['user', auth.notifRead as Handler],
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
  // 최고 관리자 전용 (삭제·권한·설정)
  cohort_delete: ['admin', admin.cohortDelete as Handler],
  member_delete: ['admin', admin.memberDelete as Handler],
  reset_link: ['admin', admin.resetLink as Handler],
  course_delete: ['admin', admin.courseDelete as Handler],
  lesson_delete: ['admin', admin.lessonDelete as Handler],
  settings: ['admin', admin.settings as Handler],
  path_delete: ['admin', admin.pathDelete as Handler],
  content_import: ['admin', admin.importContent as Handler],
};

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
    const postId = url.searchParams.get('post');
    if (postId) {
      if (!user) return out({ error: '로그인이 필요합니다.' }, 401);
      const post = await first<any>('SELECT posts.*, users.name, users.role AS author_role, COALESCE(user_profiles.avatar,0) AS avatar FROM posts JOIN users ON users.id=posts.user_id LEFT JOIN user_profiles ON user_profiles.user_id=users.id WHERE posts.id=?', postId);
      if (!post) return out({ error: '게시글을 찾을 수 없습니다.' }, 404);
      const comments = await all('SELECT comments.*, users.name, users.role AS author_role, COALESCE(user_profiles.avatar,0) AS avatar FROM comments JOIN users ON users.id=comments.user_id LEFT JOIN user_profiles ON user_profiles.user_id=users.id WHERE post_id=? ORDER BY created', postId);
      return out({ post, comments });
    }
    if (url.searchParams.get('export') === 'content') {
      if (user?.role !== 'admin') return out({ error: '최고 관리자 권한이 필요합니다.' }, 403);
      return Response.json(await admin.exportContent(), { headers: { 'Content-Disposition': `attachment; filename="sellerbricks-edu-content-${new Date().toISOString().slice(0, 10)}.json"`, 'Cache-Control': 'private, no-store' } });
    }
    return out(await buildPayload(user));
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

    // 영상 업로드 (multipart)
    if (req.headers.get('content-type')?.includes('multipart/form-data')) {
      const u = await current(req);
      if (!isStaff(u?.role)) return out({ error: '관리자 권한이 필요합니다.' }, 403);
      const f = await req.formData();
      const file = f.get('file') as File | null, id = String(f.get('lessonId') || '');
      if (f.get('kind') === 'file') {
        // 강의 자료 파일 (PDF·이미지·문서, 20MB)
        const okTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'text/plain', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.openxmlformats-officedocument.presentationml.presentation', 'application/zip'];
        if (!file || file.size > 20 * 1024 * 1024 || !okTypes.includes(file.type)) return out({ error: '20MB 이하의 PDF·이미지·문서 파일을 선택해 주세요.' }, 400);
        if (!(await first('SELECT id FROM lessons WHERE id=?', id))) return out({ error: '강의를 찾을 수 없습니다.' }, 404);
        const b = bucket();
        if (!b) return out({ error: '파일 저장소가 연결되지 않았습니다.' }, 503);
        const key = 'file-' + uid();
        await b.put(key, file.stream(), { httpMetadata: { contentType: file.type, contentDisposition: `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}` } });
        await run('INSERT INTO lesson_files (id,lesson_id,name,key,size,type,created) VALUES (?,?,?,?,?,?,?)', uid(), id, file.name.slice(0, 200), key, file.size, file.type, now());
        return out({ ok: true });
      }
      const maxMb = Number(settings.max_video_mb) || 50;
      if (!file || file.size > maxMb * 1024 * 1024 || !['video/mp4', 'video/webm'].includes(file.type)) return out({ error: `${maxMb}MB 이하의 MP4 또는 WebM 영상을 선택해 주세요.` }, 400);
      if (!(await first('SELECT id FROM lessons WHERE id=?', id))) return out({ error: '강의를 찾을 수 없습니다.' }, 404);
      const b = bucket();
      if (!b) return out({ error: '영상 저장소가 연결되지 않았습니다.' }, 503);
      const key = crypto.randomUUID();
      await b.put(key, file.stream(), { httpMetadata: { contentType: file.type } });
      await run('UPDATE lessons SET video=? WHERE id=?', `/api/media/${key}`, id);
      return out({ ok: true, video: `/api/media/${key}` });
    }

    const body: any = await req.json().catch(() => ({}));
    const entry = ACTIONS[String(body.action)];
    if (!entry) return out({ error: '지원하지 않는 작업입니다.' }, 400);
    const [scope, handler] = entry;
    const user = await current(req);
    if (scope !== 'public' && !user) return out({ error: '로그인이 필요합니다.' }, 401);
    if (scope === 'staff' && !isStaff(user?.role)) return out({ error: '관리자 권한이 필요합니다.' }, 403);
    if (scope === 'admin' && user?.role !== 'admin') return out({ error: '최고 관리자 권한이 필요합니다.' }, 403);
    // 운영 관리자는 역할 변경 불가
    if (user?.role === 'manager' && body.action === 'member' && body.role) return out({ error: '역할 변경은 최고 관리자만 할 수 있습니다.' }, 403);
    const ctx: Ctx = { req, body, user, settings };
    return await handler(ctx);
  } catch (e) {
    if (e instanceof HttpError) return out({ error: e.message }, e.status);
    console.error('edu request failed', e);
    return out({ error: '저장하지 못했습니다. 입력 내용을 유지한 상태로 다시 시도해 주세요.' }, 500);
  }
}
