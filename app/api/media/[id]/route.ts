import { bucket, first } from '../../../../lib/server/db';
import { current } from '../../../../lib/server/auth';
export const dynamic = 'force-dynamic';

/** R2 영상 스트리밍 — Range 요청 지원. 로그인 사용자만. */
export async function GET(req: Request, { params }: any) {
  if (!(await current(req))) return new Response('로그인이 필요합니다.', { status: 401 });
  const { id: rawId } = await params;
  const b = bucket();
  // 강의 자료 파일: lesson_files.id 로 요청되면 R2 키와 파일명을 조회
  let id = rawId, downloadName = '';
  const lf = await first<any>('SELECT key,name FROM lesson_files WHERE id=?', rawId);
  if (lf) { id = lf.key; downloadName = lf.name; }
  if (!b) return new Response('영상 저장소가 연결되지 않았습니다.', { status: 503 });
  const head = await b.head(id);
  if (!head) return new Response('영상을 찾을 수 없습니다.', { status: 404 });
  const range = req.headers.get('range');
  const match = range?.match(/^bytes=(\d+)-(\d*)$/);
  if (range && !match) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${head.size}` } });
  let start = 0, end = head.size - 1;
  if (match) {
    start = Number(match[1]);
    end = match[2] ? Math.min(Number(match[2]), end) : Math.min(start + 4 * 1024 * 1024 - 1, end); // 4MB 청크
    if (start > end || start >= head.size) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${head.size}` } });
  }
  const object = await b.get(id, match ? { range: { offset: start, length: end - start + 1 } } : undefined);
  if (!object) return new Response('영상을 찾을 수 없습니다.', { status: 404 });
  const headers = new Headers({
    'Content-Type': head.httpMetadata?.contentType || 'video/mp4',
    'Accept-Ranges': 'bytes',
    'Content-Length': String(end - start + 1),
    'Cache-Control': 'private, max-age=300',
    ETag: head.httpEtag,
  });
  if (downloadName) headers.set('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(downloadName)}`);
  if (match) headers.set('Content-Range', `bytes ${start}-${end}/${head.size}`);
  return new Response(object.body, { status: match ? 206 : 200, headers });
}
