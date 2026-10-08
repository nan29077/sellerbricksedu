'use client';
import { useEffect, useMemo, useState } from 'react';
import { Plus, Search, Heart, MessageCircle, Pin, Lock, Trash2, PenLine, ChevronLeft, Shield, Send } from 'lucide-react';
import { useEdu } from '../../../lib/edu-store';
import { relTime } from '../../../lib/learning';
import type { Comment, Post } from '../../../lib/types';
import { Button, CharacterAvatar, Empty, PageHead, Pill, Tabs, useLimit } from '../ui';

export const POST_CATEGORIES = ['전체', '자유', '질문', '방송 후기', '팁 공유', '상품 추천', '공지'];

function Author({ name, role, avatar }: { name: string; role: string; avatar: number }) {
  return <span className="author"><CharacterAvatar index={avatar} /><b>{name}</b>{role !== 'student' && <Pill tone="info"><Shield size={10} /> 운영진</Pill>}</span>;
}

export function LoungePage() {
  const { data, user, admin, go, openModal, act, perform, ask, patch } = useEdu();
  const [category, setCategory] = useState('전체');
  const [search, setSearch] = useState('');
  const [mine, setMine] = useState(false);
  const posts = useMemo(() => (data?.posts ?? []).filter((p) => (category === '전체' || p.category === category) && (!mine || p.user_id === user?.id) && (!search || p.title.includes(search) || p.excerpt.includes(search) || p.name.includes(search))), [data?.posts, category, search, mine, user?.id]);
  const [visiblePosts, more] = useLimit(posts, 20);
  if (!data || !user) return null;
  return (
    <>
      <PageHead title="셀러 라운지" sub="동료 셀러와 방송 후기, 팁, 질문을 나누는 공간입니다. 서로의 경험이 가장 좋은 교재예요." action={<Button small onClick={() => openModal('post', { category: '자유', title: '', body: '' })}><Plus size={16} /> 글쓰기</Button>} />
      <div className="filter-row">
        <Tabs items={POST_CATEGORIES} value={category} onChange={setCategory} />
        <div className="search"><Search size={17} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="제목·내용·작성자 검색" aria-label="라운지 검색" /></div>
      </div>
      <div className="filter-row secondary"><label className="check-label inline"><input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} /><span>내가 쓴 글만</span></label><span className="small-muted">{posts.length}개</span></div>
      {posts.length ? (
        <div className="post-list">
          {visiblePosts.map((p) => (
            <article className={'panel post-card ' + (p.pinned ? 'pinned' : '')} key={p.id}>
              <div className="post-top"><Author name={p.name} role={p.author_role} avatar={p.avatar} /><small>{relTime(p.created)}</small></div>
              <h3><button onClick={() => go('/learn/lounge/' + p.id)}>{p.pinned ? <Pin size={14} className="purple" /> : null}{p.locked ? <Lock size={13} /> : null}<Pill>{p.category}</Pill>{p.title}</button></h3>
              <p className="clamp">{p.excerpt}</p>
              <div className="post-meta">
                <button className={p.liked ? 'on' : ''} onClick={() => { patch((d) => ({ ...d, posts: d.posts.map((x) => x.id === p.id ? { ...x, liked: x.liked ? 0 : 1, likes: x.likes + (x.liked ? -1 : 1) } : x) })); act('like', { id: p.id }, true); }}><Heart size={14} fill={p.liked ? 'currentColor' : 'none'} /> {p.likes}</button>
                <button onClick={() => go('/learn/lounge/' + p.id)}><MessageCircle size={14} /> {p.comments}</button>
                {(p.user_id === user.id || admin) && <button onClick={async () => { if (await ask('게시글을 삭제할까요?', '댓글도 함께 삭제됩니다.', { danger: true, confirmLabel: '삭제' })) perform('post_delete', { id: p.id }, '게시글을 삭제했습니다.'); }}><Trash2 size={14} /></button>}
                {admin && <button onClick={() => perform('post_update', { id: p.id, pinned: p.pinned ? 0 : 1 }, p.pinned ? '고정을 해제했습니다.' : '상단에 고정했습니다.')}><Pin size={14} /> {p.pinned ? '고정 해제' : '고정'}</button>}
              </div>
            </article>
          ))}
          {more}
        </div>
      ) : <Empty title="아직 글이 없어요" description="첫 방송 후기나 궁금한 점을 가장 먼저 나눠보세요." icon={MessageCircle} action={<Button small onClick={() => openModal('post', { category: '자유', title: '', body: '' })}>글쓰기</Button>} />}
    </>
  );
}

export function PostPage({ id }: { id: string }) {
  const { data, user, admin, go, perform, ask, act, openModal, busy, setToast, patch } = useEdu();
  const [detail, setDetail] = useState<{ post: Post & { body: string }; comments: Comment[] } | null>(null);
  const [error, setError] = useState('');
  const [text, setText] = useState('');
  const [tick, setTick] = useState(0);
  const listItem = data?.posts.find((p) => p.id === id);
  useEffect(() => {
    let alive = true;
    fetch('/api/edu?post=' + encodeURIComponent(id), { cache: 'no-store', credentials: 'same-origin' }).then(async (r) => { const j: any = await r.json(); if (!alive) return; if (!r.ok) setError(j.error); else setDetail(j); });
    return () => { alive = false; };
  }, [id, tick]);
  if (!user) return null;
  if (error) return <Empty title={error} action={<Button small secondary onClick={() => go('/learn/lounge')}>라운지로</Button>} />;
  if (!detail) return <div className="loading inline"><div className="spinner" /></div>;
  const { post, comments } = detail;
  const canEdit = post.user_id === user.id || admin;
  return (
    <div className="post-detail">
      <button className="back" onClick={() => go('/learn/lounge')}><ChevronLeft size={16} /> 셀러 라운지</button>
      <article className="panel">
        <div className="post-top"><Author name={post.name} role={post.author_role} avatar={post.avatar} /><small>{relTime(post.created)}{post.updated !== post.created ? ' · 수정됨' : ''}</small></div>
        <h1><Pill>{post.category}</Pill> {post.title}</h1>
        <p className="post-body">{post.body}</p>
        <div className="post-meta">
          <button className={listItem?.liked ? 'on' : ''} onClick={() => { patch((d) => ({ ...d, posts: d.posts.map((x) => x.id === post.id ? { ...x, liked: x.liked ? 0 : 1, likes: x.likes + (x.liked ? -1 : 1) } : x) })); act('like', { id: post.id }, true); }}><Heart size={15} fill={listItem?.liked ? 'currentColor' : 'none'} /> 좋아요 {listItem?.likes ?? 0}</button>
          {canEdit && <button onClick={() => openModal('post', { id: post.id, category: post.category, title: post.title, body: post.body })}><PenLine size={14} /> 수정</button>}
          {canEdit && <button onClick={async () => { if (await ask('게시글을 삭제할까요?', undefined, { danger: true, confirmLabel: '삭제' })) { const r = await perform('post_delete', { id: post.id }, '게시글을 삭제했습니다.'); if (r) go('/learn/lounge'); } }}><Trash2 size={14} /> 삭제</button>}
          {admin && <><button onClick={() => perform('post_update', { id: post.id, pinned: post.pinned ? 0 : 1 }, '변경했습니다.')}><Pin size={14} /> {post.pinned ? '고정 해제' : '고정'}</button><button onClick={() => perform('post_update', { id: post.id, locked: post.locked ? 0 : 1 }, '변경했습니다.').then(() => setTick((t) => t + 1))}><Lock size={14} /> {post.locked ? '댓글 열기' : '댓글 잠금'}</button></>}
        </div>
      </article>
      <div className="panel">
        <h3><MessageCircle size={18} /> 댓글 {comments.length}</h3>
        {comments.map((c) => (
          <div className="comment" key={c.id}>
            <Author name={c.name} role={c.author_role} avatar={c.avatar} />
            <p>{c.body}</p>
            <div className="qa-meta"><small>{relTime(c.created)}</small>{(c.user_id === user.id || admin) && <button className="text-link" onClick={async () => { if (await ask('댓글을 삭제할까요?')) { await perform('comment_delete', { id: c.id }, '댓글을 삭제했습니다.'); setTick((t) => t + 1); } }}><Trash2 size={12} /> 삭제</button>}</div>
          </div>
        ))}
        {post.locked && !admin ? <p className="muted small-muted"><Lock size={13} /> 댓글이 잠긴 게시글입니다.</p> : (
          <form className="comment-form" onSubmit={async (e) => { e.preventDefault(); if (!text.trim()) return; try { await act('comment', { postId: post.id, body: text }); setText(''); setTick((t) => t + 1); } catch (err: any) { setToast(err.message, 'error'); } }}>
            <textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder="따뜻한 댓글을 남겨주세요." maxLength={3000} />
            <Button small type="submit" disabled={busy || !text.trim()}><Send size={14} /> 등록</Button>
          </form>
        )}
      </div>
    </div>
  );
}
