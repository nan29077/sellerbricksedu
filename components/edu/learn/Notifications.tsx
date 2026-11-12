'use client';
import { useMemo, useState } from 'react';
import { Bell, CheckCheck, Mail, Trash2 } from 'lucide-react';
import { useEdu } from '../../../lib/edu-store';
import { relTime } from '../../../lib/learning';
import { Button, Empty, PageHead, Pill, Tabs, useLimit } from '../ui';

const TYPE_LABEL: Record<string, string> = { reply: '답변', announcement: '공지', assignment: '과제', approval: '계정', certificate: '수료', system: '안내', question: '질문', event: '일정' };

/** 전체 알림 목록 + 메일 수신 설정 */
export function NotificationsPage() {
  const { data, user, act, go, perform, busy, admin } = useEdu();
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const list = useMemo(() => (data?.notifications ?? []).filter((n) => filter === 'all' || !n.read), [data?.notifications, filter]);
  const [visible, more] = useLimit(list, 30);
  if (!data || !user) return null;
  const types = data.emailTypes ?? [];
  let prefs: any = {};
  try { prefs = user.notify_prefs ? JSON.parse(user.notify_prefs) : {}; } catch { prefs = {}; }
  const on = (t: { type: string; student: boolean; staff: boolean }) => (typeof prefs?.email?.[t.type] === 'boolean' ? prefs.email[t.type] : admin ? t.staff : t.student);
  const shown = types.filter((t) => (admin ? t.type !== 'reply' && t.type !== 'certificate' : t.type !== 'question'));
  const toggle = (type: string, value: boolean) => {
    const email: Record<string, boolean> = {};
    for (const t of shown) email[t.type] = t.type === type ? value : on(t);
    perform('preferences', { email }, value ? '메일로도 받아요.' : '메일 수신을 껐어요.');
  };
  const unread = (data.notifications ?? []).filter((n) => !n.read).length;
  return (
    <>
      <PageHead title="알림" sub="답변·공지·과제·일정 소식을 한곳에서 확인하세요." action={<div className="admin-actions">
        {unread > 0 && <Button small secondary onClick={() => act('notif_read', { all: true })}><CheckCheck size={15} /> 모두 읽음</Button>}
        {(data.notifications ?? []).some((n) => n.read) && <Button small secondary onClick={() => act('notif_clear')}><Trash2 size={15} /> 읽은 알림 지우기</Button>}
      </div>} />
      <div className="notif-page">
        <section className="panel">
          <Tabs items={[['all', `전체 ${(data.notifications ?? []).length}`], ['unread', `안 읽음 ${unread}`]]} value={filter} onChange={setFilter} />
          {visible.length ? (
            <ul className="notif-list">
              {visible.map((n) => (
                <li key={n.id} className={n.read ? '' : 'unread'}>
                  <button onClick={async () => { if (!n.read) await act('notif_read', { id: n.id }, true); if (n.link) go(n.link); }}>
                    <Pill tone={n.read ? '' : 'info'}>{TYPE_LABEL[n.type] || '알림'}</Pill>
                    <span><b>{n.title}</b>{n.body && <p>{n.body}</p>}</span>
                    <small>{relTime(n.created)}</small>
                  </button>
                </li>
              ))}
            </ul>
          ) : <Empty title={filter === 'unread' ? '안 읽은 알림이 없어요' : '알림이 없어요'} icon={Bell} />}
          {more}
          <p className="small-muted">알림은 최근 100건까지 보이며, 읽은 알림은 90일 뒤 자동으로 정리됩니다.</p>
        </section>
        <aside className="panel notif-prefs">
          <h3><Mail size={18} /> 메일 알림</h3>
          {user.id.startsWith('demo-') ? <p className="muted">체험 계정은 메일을 받지 않습니다.</p>
            : !data.mailReady ? <p className="muted">운영팀이 메일 발송을 설정하면 중요한 알림을 메일로도 받을 수 있어요.</p>
            : user.email.endsWith('@oauth.sellerbricks.local') ? <p className="muted">소셜 로그인에서 이메일을 받지 못해 메일 알림을 보낼 수 없어요.</p>
            : (
              <>
                <p className="muted small-muted">{user.email} 로 보내드려요.</p>
                {shown.map((t) => (
                  <label className="check-label" key={t.type}><input type="checkbox" disabled={busy} checked={on(t)} onChange={(e) => toggle(t.type, e.target.checked)} /><span>{t.label}</span></label>
                ))}
              </>
            )}
        </aside>
      </div>
    </>
  );
}
