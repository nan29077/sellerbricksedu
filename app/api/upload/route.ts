import { seed, bucket, run, first, uid, now, bumpVersion } from '../../../lib/server/db';
import { out, sameOrigin } from '../../../lib/server/http';
import { current, isStaff, isDemo } from '../../../lib/server/auth';
import { getSettings } from '../../../lib/server/settings';
import { releaseMedia } from '../../../lib/server/handlers/admin';
export const dynamic = 'force-dynamic';

const FILE_TYPES = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'text/plain', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.openxmlformats-officedocument.presentationml.presentation', 'application/zip'];
const VIDEO_TYPES = ['video/mp4', 'video/webm'];

/**
 * 강의 영상·자료·자막 업로드 — 요청 본문을 그대로 R2 로 스트리밍한다(Worker 메모리에 파일 전체를 올리지 않음).
 * POST /api/upload?lessonId=..&kind=video|file|captions&name=파일명  (Content-Type, Content-Length 필수)
 */
export async function POST(req: Request) {
  const res = await handle(req);
  // 거절한 요청의 본문은 읽지 않았으므로 정리 (연결 재사용 시 다음 요청이 깨지지 않게)
  if (!req.bodyUsed && req.body) {
    try {
      if (Number(req.headers.get('content-length') || 0) > 25 * 1024 * 1024) await req.body.cancel();
      else { const rd = req.body.getReader(); while (!(await rd.read()).done) { /* 버림 */ } }
    } catch { /* 연결 종료 */ }
  }
  return res;
}

async function handle(req: Request) {
  try {
    if (!sameOrigin(req)) return out({ error: '요청을 확인할 수 없습니다.' }, 403);
    await seed();
    const u = await current(req);
    if (!isStaff(u?.role)) return out({ error: '관리자 권한이 필요합니다.' }, 403);
    if (isDemo(u)) return out({ error: '체험 관리자 계정은 파일을 올릴 수 없어요.' }, 403);
    const url = new URL(req.url);
    const lessonId = url.searchParams.get('lessonId') || '';
    const kind = url.searchParams.get('kind') || 'video';
    const name = (url.searchParams.get('name') || 'file').replace(/[\r\n"\\/]/g, '').slice(0, 200) || 'file';
    const type = (req.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    const size = Number(req.headers.get('content-length') || 0);
    if (!req.body || !size) return out({ error: '파일을 선택해 주세요.' }, 400);
    const lesson = await first<{ id: string; video: string; captions: string }>('SELECT id, video, captions FROM lessons WHERE id=?', lessonId);
    if (!lesson) return out({ error: '강의를 찾을 수 없습니다. 강의를 먼저 저장해 주세요.' }, 404);
    const b = bucket();
    if (!b) return out({ error: '파일 저장소가 연결되지 않았습니다.' }, 503);
    const settings = await getSettings();

    if (kind === 'file') {
      if (size > 20 * 1024 * 1024 || !FILE_TYPES.includes(type)) return out({ error: '20MB 이하의 PDF·이미지·문서 파일을 선택해 주세요.' }, 400);
      const key = 'file-' + uid();
      await b.put(key, req.body, { httpMetadata: { contentType: type, contentDisposition: `attachment; filename*=UTF-8''${encodeURIComponent(name)}` } });
      await run('INSERT INTO lesson_files (id,lesson_id,name,key,size,type,created) VALUES (?,?,?,?,?,?,?)', uid(), lessonId, name, key, size, type, now());
      await bumpVersion();
      return out({ ok: true });
    }
    if (kind === 'captions') {
      if (size > 1024 * 1024 || !['text/vtt', 'text/plain', 'application/octet-stream'].includes(type) || !/\.vtt$/i.test(name)) return out({ error: '1MB 이하의 WebVTT(.vtt) 자막 파일을 선택해 주세요.' }, 400);
      const key = 'vtt-' + uid();
      await b.put(key, req.body, { httpMetadata: { contentType: 'text/vtt; charset=utf-8' } });
      await run('UPDATE lessons SET captions=? WHERE id=?', `/api/media/${key}`, lessonId);
      await releaseMedia(lesson.captions);
      await bumpVersion();
      return out({ ok: true, captions: `/api/media/${key}` });
    }
    const maxMb = Math.min(95, Number(settings.max_video_mb) || 50);
    if (size > maxMb * 1024 * 1024 || !VIDEO_TYPES.includes(type)) return out({ error: `${maxMb}MB 이하의 MP4 또는 WebM 영상을 선택해 주세요. 더 큰 영상은 YouTube·Vimeo·Cloudflare Stream 주소를 사용하세요.` }, 400);
    const key = crypto.randomUUID();
    await b.put(key, req.body, { httpMetadata: { contentType: type } });
    await run('UPDATE lessons SET video=? WHERE id=?', `/api/media/${key}`, lessonId);
    // 이전 영상은 다른 강의(복제본 등)가 쓰지 않을 때만 삭제
    await releaseMedia(lesson.video);
    await bumpVersion();
    return out({ ok: true, video: `/api/media/${key}` });
  } catch (e) {
    console.error('upload failed', e);
    return out({ error: '업로드하지 못했습니다. 파일 크기와 네트워크를 확인해 주세요.' }, 500);
  }
}
