import { first, run, now, uid, HttpError } from '../db';
import { out, str, bool } from '../http';
import { notifyAdmins, logActivity } from '../notify';
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
  await run(user.role === 'admin' ? 'DELETE FROM messages WHERE id=?' : "DELETE FROM messages WHERE id=? AND user_id=? AND reply=''", ...(user.role === 'admin' ? [str(body.id, 100)] : [str(body.id, 100), user.id]));
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
