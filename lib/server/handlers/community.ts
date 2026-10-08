import { first, run, batch, stmt, now, uid, HttpError } from '../db';
import { out, str, bool } from '../http';
import { notify, notifyAdmins, logActivity } from '../notify';
import type { AuthedCtx } from './types';

export async function question({ body, user }: AuthedCtx) {
  const text = str(body.body, 5000);
  if (!text) throw new HttpError(400, '질문을 입력해 주세요.');
  const lessonId = body.lessonId ? str(body.lessonId, 100) : null;
  const lesson = lessonId ? await first<any>('SELECT title FROM lessons WHERE id=?', lessonId) : null;
  await run('INSERT INTO messages (id,user_id,lesson_id,body,created,public) VALUES (?,?,?,?,?,?)', uid(), user.id, lessonId, text, now(), body.isPublic === undefined ? 1 : bool(body.isPublic));
  await notifyAdmins('question', `새 질문: ${lesson?.title || '학습 문의'}`, text.slice(0, 120), '/admin/questions');
  await logActivity(user.id, 'question', lesson?.title || '');
  return out({ ok: true });
}

export async function questionDelete({ body, user }: AuthedCtx) {
  const staff = user.role !== 'student';
  const r = await run(staff ? 'DELETE FROM messages WHERE id=?' : "DELETE FROM messages WHERE id=? AND user_id=? AND reply=''", ...(staff ? [str(body.id, 100)] : [str(body.id, 100), user.id]));
  if (!r.meta.changes) throw new HttpError(403, '삭제할 수 없는 질문입니다. 답변이 달린 질문은 삭제되지 않아요.');
  await run('DELETE FROM question_votes WHERE message_id=?', str(body.id, 100));
  return out({ ok: true });
}

export async function vote({ body, user }: AuthedCtx) {
  const id = str(body.id, 100);
  const m = await first<any>('SELECT id,user_id,public FROM messages WHERE id=?', id);
  if (!m || (!m.public && m.user_id !== user.id)) throw new HttpError(404, '질문을 찾을 수 없습니다.');
  const voted = await first('SELECT 1 FROM question_votes WHERE message_id=? AND user_id=?', id, user.id);
  if (voted) await run('DELETE FROM question_votes WHERE message_id=? AND user_id=?', id, user.id);
  else await run('INSERT INTO question_votes (message_id,user_id) VALUES (?,?)', id, user.id);
  return out({ ok: true, voted: !voted });
}

const HOSTS: Record<string, string[]> = {
  youtube: ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be'],
  instagram: ['instagram.com', 'www.instagram.com'],
  tiktok: ['tiktok.com', 'www.tiktok.com'],
  x: ['x.com', 'www.x.com', 'twitter.com', 'www.twitter.com'],
  naver: ['blog.naver.com', 'm.blog.naver.com', 'smartstore.naver.com', 'm.smartstore.naver.com'],
};


export async function channel({ body, user }: AuthedCtx) {
  let url: URL;
  try {
    url = new URL(String(body.url));
    if (url.protocol !== 'https:' || !HOSTS[body.platform]?.includes(url.hostname) || url.username || url.password || url.port) throw 0;
  } catch {
    throw new HttpError(400, '선택한 플랫폼의 HTTPS 채널 주소를 입력해 주세요.');
  }
  await run(
    'INSERT INTO channels (user_id,platform,url,bio,shared,created) VALUES (?,?,?,?,?,?) ON CONFLICT(user_id,platform) DO UPDATE SET url=excluded.url,bio=excluded.bio,shared=excluded.shared',
    user.id, body.platform, url.href, str(body.bio, 300), bool(body.shared), now(),
  );
  return out({ ok: true });
}

export async function channelRemove({ body, user }: AuthedCtx) {
  await run('DELETE FROM channels WHERE user_id=? AND platform=?', user.id, str(body.platform, 30));
  return out({ ok: true });
}

export async function visit({ body, user }: AuthedCtx) {
  if (body.targetId === user.id) return out({ ok: true });
  const ch = await first('SELECT url FROM channels WHERE user_id=? AND platform=? AND shared=1', str(body.targetId, 100), str(body.platform, 30));
  if (!ch) throw new HttpError(404, '공개된 채널을 찾을 수 없습니다.');
  await run('INSERT OR REPLACE INTO channel_visits (user_id,target_id,platform,created) VALUES (?,?,?,?)', user.id, body.targetId, body.platform, now());
  return out({ ok: true });
}

// ───────── 셀러 라운지 ─────────
export const POST_CATEGORIES = ['자유', '질문', '방송 후기', '팁 공유', '상품 추천', '공지'];
export async function post({ body, user }: AuthedCtx) {
  const title = str(body.title, 120), text = str(body.body, 10000);
  const category = POST_CATEGORIES.includes(body.category) ? body.category : '자유';
  if (!title || !text) throw new HttpError(400, '제목과 내용을 입력해 주세요.');
  if (category === '공지' && user.role === 'student') throw new HttpError(403, '공지는 운영진만 작성할 수 있습니다.');
  if (body.id) {
    const p = await first<any>('SELECT user_id FROM posts WHERE id=?', body.id);
    if (!p || (p.user_id !== user.id && user.role === 'student')) throw new HttpError(403, '수정 권한이 없습니다.');
    await run('UPDATE posts SET title=?,body=?,category=?,updated=? WHERE id=?', title, text, category, now(), body.id);
    return out({ ok: true, id: body.id });
  }
  const id = uid();
  await run('INSERT INTO posts (id,user_id,category,title,body,pinned,locked,created,updated) VALUES (?,?,?,?,?,0,0,?,?)', id, user.id, category, title, text, now(), now());
  await logActivity(user.id, 'post', title);
  return out({ ok: true, id });
}
export async function postDelete({ body, user }: AuthedCtx) {
  const id = str(body.id, 100);
  const p = await first<any>('SELECT user_id FROM posts WHERE id=?', id);
  if (!p) throw new HttpError(404, '게시글을 찾을 수 없습니다.');
  if (p.user_id !== user.id && user.role === 'student') throw new HttpError(403, '삭제 권한이 없습니다.');
  await batch([stmt('DELETE FROM comments WHERE post_id=?', id), stmt('DELETE FROM post_likes WHERE post_id=?', id), stmt('DELETE FROM posts WHERE id=?', id)]);
  return out({ ok: true });
}
export async function postUpdate({ body, user }: AuthedCtx) {
  if (user.role === 'student') throw new HttpError(403, '운영진만 가능합니다.');
  const id = str(body.id, 100);
  const sets: string[] = [], vals: unknown[] = [];
  for (const k of ['pinned', 'locked']) if (body[k] !== undefined) { sets.push(`${k}=?`); vals.push(bool(body[k])); }
  if (!sets.length) throw new HttpError(400, '변경할 항목이 없습니다.');
  await run(`UPDATE posts SET ${sets.join(',')} WHERE id=?`, ...vals, id);
  return out({ ok: true });
}
export async function comment({ body, user }: AuthedCtx) {
  const postId = str(body.postId, 100), text = str(body.body, 3000);
  if (!text) throw new HttpError(400, '댓글을 입력해 주세요.');
  const p = await first<any>('SELECT user_id, locked, title FROM posts WHERE id=?', postId);
  if (!p) throw new HttpError(404, '게시글을 찾을 수 없습니다.');
  if (p.locked && user.role === 'student') throw new HttpError(403, '댓글이 잠긴 게시글입니다.');
  await run('INSERT INTO comments (id,post_id,user_id,body,created) VALUES (?,?,?,?,?)', uid(), postId, user.id, text, now());
  if (p.user_id !== user.id) await notify([p.user_id], 'system', '내 게시글에 댓글이 달렸어요', `${user.name}: ${text.slice(0, 80)}`, '/learn/lounge/' + postId);
  return out({ ok: true });
}
export async function commentDelete({ body, user }: AuthedCtx) {
  const id = str(body.id, 100);
  const c = await first<any>('SELECT user_id FROM comments WHERE id=?', id);
  if (!c) throw new HttpError(404, '댓글을 찾을 수 없습니다.');
  if (c.user_id !== user.id && user.role === 'student') throw new HttpError(403, '삭제 권한이 없습니다.');
  await run('DELETE FROM comments WHERE id=?', id);
  return out({ ok: true });
}
export async function like({ body, user }: AuthedCtx) {
  const id = str(body.id, 100);
  if (!(await first('SELECT 1 FROM posts WHERE id=?', id))) throw new HttpError(404, '게시글을 찾을 수 없습니다.');
  const liked = await first('SELECT 1 FROM post_likes WHERE post_id=? AND user_id=?', id, user.id);
  if (liked) await run('DELETE FROM post_likes WHERE post_id=? AND user_id=?', id, user.id);
  else await run('INSERT INTO post_likes (post_id,user_id) VALUES (?,?)', id, user.id);
  return out({ ok: true, liked: !liked });
}
