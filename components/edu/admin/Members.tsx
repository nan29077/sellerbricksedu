'use client';
import { useMemo, useState } from 'react';
import { Search, Download, KeyRound, Trash2, ShieldCheck, CheckSquare, Square, UserPlus, Copy, BellRing, StickyNote, Shield } from 'lucide-react';
import { useEdu } from '../../../lib/edu-store';
import { ROLES } from '../../../lib/constants';
import { downloadCsv, fmtLong, fmtShort, relTime } from '../../../lib/learning';
import { Button, CharacterAvatar, Empty, PageHead, Pill, ProgressBar, Tabs, statusLabel, statusTone } from '../ui';

type Status = 'all' | 'pending' | 'active' | 'suspended' | 'staff' | 'inactive';

export function AdminMembers({ report = false }: { report?: boolean }) {
  const { data, courses, lessons, perform, ask, openModal, setToast, act, superAdmin, user: me } = useEdu();
  const params = typeof location !== 'undefined' ? new URLSearchParams(location.search) : null;
  const [search, setSearch] = useState('');
  const [cohortFilter, setCohortFilter] = useState(params?.get('cohort') || 'all');
  const [status, setStatus] = useState<Status>((params?.get('status') as Status) || 'all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sort, setSort] = useState<'recent' | 'name' | 'progress' | 'active'>('recent');
  const users = useMemo(() => data?.users ?? [], [data?.users]);
  const allProgress = data?.allProgress ?? [];
  const [weekAgo] = useState(() => new Date(Date.now() - 7 * 86400000).toISOString());
  const list = useMemo(() => users.filter((u) =>
    (status === 'staff' ? u.role !== 'student' : u.role === 'student') &&
    (u.name.includes(search) || u.email.includes(search)) &&
    (cohortFilter === 'all' || (cohortFilter === 'none' ? !u.cohort_id : u.cohort_id === cohortFilter)) &&
    (status === 'all' || status === 'staff' || (status === 'inactive' ? u.status === 'active' && (!u.last_active || u.last_active < weekAgo) : u.status === status)))
    .sort((a, b) => sort === 'name' ? a.name.localeCompare(b.name) : sort === 'progress' ? b.completed - a.completed : sort === 'active' ? (b.last_active || '').localeCompare(a.last_active || '') : b.created.localeCompare(a.created)), [users, search, cohortFilter, status, sort, weekAgo]);
  if (!data) return null;
  const students = users.filter((u) => u.role === 'student');
  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const allSelected = list.length > 0 && list.every((u) => selected.has(u.id));
  const ids = Array.from(selected);
  const resets = data.resets ?? [];

  const exportCsv = () => downloadCsv(report ? 'sellerbricks-learning.csv' : 'sellerbricks-members.csv', report
    ? [['이름', '이메일', '기수', '과정', '강의', '시청(초)', '완료', '완료일', '최고 점수', '응시 횟수'], ...list.flatMap((u) => lessons.map((l) => { const p = allProgress.find((x) => x.user_id === u.id && x.lesson_id === l.id); return [u.name, u.email, data.cohorts.find((c) => c.id === u.cohort_id)?.name || '', courses.find((c) => c.id === l.course_id)?.title || '', l.title, p?.watched || 0, p?.complete ? '완료' : '미완료', p?.completed_at?.slice(0, 10) || '', p?.best_score ?? '', p?.attempts || 0]; }))]
    : [['이름', '이메일', '역할', '상태', '기수', '가입일', '최근 활동', '완료 강의', '시청(분)', '로그인 방식', '메모'], ...list.map((u) => [u.name, u.email, ROLES[u.role], statusLabel[u.status], data.cohorts.find((c) => c.id === u.cohort_id)?.name || '', u.created.slice(0, 10), u.last_active?.slice(0, 10) || '', u.completed, Math.round(u.watched / 60), (data.oauthAccounts ?? []).filter((o) => o.user_id === u.id).map((o) => o.provider).join('+') || (u.has_password ? '이메일' : '-'), u.memo])]);

  const tabs: [Status, string][] = [['all', `전체 (${students.length})`], ['pending', `승인 대기 (${students.filter((u) => u.status === 'pending').length})`], ['active', '학습 가능'], ['inactive', `7일 미접속 (${students.filter((u) => u.status === 'active' && (!u.last_active || u.last_active < weekAgo)).length})`], ['suspended', '이용 중지']];
  if (!report) tabs.push(['staff', `운영진 (${users.filter((u) => u.role !== 'student').length})`]);

  return (
    <>
      <PageHead title={report ? '교육생 학습 현황' : '교육생 관리'} sub={report ? '교육생별 시청 시간, 강의 완료와 퀴즈 결과를 확인하고 CSV로 내려받으세요.' : '가입 승인, 기수 배정, 계정 상태, 메모와 독려 알림을 관리하세요. 여러 명을 선택해 한 번에 처리할 수 있어요.'}
        action={<div className="head-actions"><Button small secondary onClick={exportCsv}><Download size={15} /> CSV</Button>{!report && <Button small onClick={() => openModal('invite', { name: '', email: '', cohortId: '' })}><UserPlus size={15} /> 교육생 직접 등록</Button>}</div>} />
      {!report && students.filter((u) => u.status === 'pending').length > 0 && status === 'all' && (
        <div className="info-note warn"><ShieldCheck size={17} /> 승인 대기 교육생 {students.filter((u) => u.status === 'pending').length}명이 있어요. <button className="text-link" onClick={() => setStatus('pending')}>대기 목록 보기</button></div>
      )}
      <div className="filter-row">
        <Tabs items={tabs} value={status} onChange={setStatus} />
        <div className="search"><Search size={17} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="이름 또는 이메일 검색" aria-label="교육생 검색" /></div>
      </div>
      <div className="filter-row secondary">
        <select aria-label="기수별 교육생" value={cohortFilter} onChange={(e) => setCohortFilter(e.target.value)}><option value="all">모든 기수</option><option value="none">기수 미배정</option>{data.cohorts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        <select aria-label="정렬" value={sort} onChange={(e) => setSort(e.target.value as any)}><option value="recent">최근 가입순</option><option value="active">최근 활동순</option><option value="progress">완료 강의순</option><option value="name">이름순</option></select>
        <button className="text-link" onClick={() => setSelected(allSelected ? new Set() : new Set(list.map((u) => u.id)))}>{allSelected ? <CheckSquare size={15} /> : <Square size={15} />} 전체 선택</button>
        <span className="small-muted">{list.length}명</span>
      </div>
      {ids.length > 0 && (
        <div className="bulk-bar">
          <b>{ids.length}명 선택</b>
          <Button small onClick={() => perform('member', { ids, status: 'active' }, `${ids.length}명을 승인했습니다.`).then(() => setSelected(new Set()))}>승인</Button>
          <Button small secondary onClick={() => openModal('nudge', { ids, title: '', body: '', link: '/learn' })}><BellRing size={14} /> 알림 보내기</Button>
          <select aria-label="선택 교육생 기수 배정" defaultValue="" onChange={(e) => { if (e.target.value !== '') perform('assign_cohort', { userIds: ids, cohortId: e.target.value === 'none' ? '' : e.target.value }, '기수를 배정했습니다.').then(() => setSelected(new Set())); }}><option value="" disabled>기수 배정…</option><option value="none">미배정</option>{data.cohorts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
          <Button small secondary onClick={() => perform('member', { ids, status: 'suspended' }, '이용을 중지했습니다.').then(() => setSelected(new Set()))}>이용 중지</Button>
          <button className="text-link" onClick={() => setSelected(new Set())}>선택 해제</button>
        </div>
      )}
      <div className="members-grid">
        {list.map((u) => {
          const ps = allProgress.filter((p) => p.user_id === u.id);
          const percent = lessons.length ? Math.round((ps.filter((p) => p.complete).length / lessons.length) * 100) : 0;
          const reset = resets.find((r) => r.user_id === u.id);
          const providers = (data.oauthAccounts ?? []).filter((o) => o.user_id === u.id).map((o) => o.provider);
          const isMe = u.id === me?.id;
          const staff = u.role !== 'student';
          return (
            <div className={'panel member-card ' + (selected.has(u.id) ? 'selected' : '')} key={u.id}>
              <div className="member-top">
                {!staff && <button className="select-box" onClick={() => toggle(u.id)} aria-label="선택" aria-pressed={selected.has(u.id)}>{selected.has(u.id) ? <CheckSquare size={18} /> : <Square size={18} />}</button>}
                <CharacterAvatar index={u.avatar} />
                <div><h3>{u.name}{isMe && <small className="muted"> (나)</small>}</h3><p>{u.email}</p></div>
                {staff ? <Pill tone="info"><Shield size={11} /> {ROLES[u.role]}</Pill> : <Pill tone={statusTone[u.status]}>{statusLabel[u.status]}</Pill>}
              </div>
              {!staff && <ProgressBar value={percent} label="전체 학습 진도" />}
              <div className="member-metrics">
                {!staff && <><span>{u.completed}강 완료</span><span>{fmtLong(u.watched)} 시청</span></>}
                <span>가입 {fmtShort(u.created)}</span><span>{u.last_active ? `활동 ${relTime(u.last_active)}` : '활동 없음'}</span>
                {providers.length > 0 && <span>{providers.map((p) => p === 'kakao' ? '카카오' : '네이버').join('·')} 로그인</span>}
              </div>
              {u.memo && <p className="member-memo"><StickyNote size={13} /> {u.memo}</p>}
              {!staff && (
                <div className="form-two">
                  <select aria-label={u.name + ' 기수 배정'} value={u.cohort_id || ''} onChange={(e) => perform('assign_cohort', { userId: u.id, cohortId: e.target.value }, '기수를 배정했습니다.')}><option value="">기수 미배정</option>{data.cohorts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
                  {!report && <select aria-label={u.name + ' 계정 상태'} value={u.status} onChange={(e) => perform('member', { id: u.id, status: e.target.value }, '교육생 상태를 변경했습니다.')}><option value="pending">승인 대기</option><option value="active">학습 승인</option><option value="suspended">이용 중지</option></select>}
                </div>
              )}
              {staff && superAdmin && !isMe && (
                <div className="form-two">
                  <select aria-label={u.name + ' 역할'} value={u.role} onChange={async (e) => { if (await ask(`${u.name}님의 역할을 '${ROLES[e.target.value as keyof typeof ROLES]}'(으)로 변경할까요?`)) perform('member', { id: u.id, role: e.target.value }, '역할을 변경했습니다.'); }}><option value="manager">운영 관리자</option><option value="admin">최고 관리자</option><option value="student">셀러 교육생</option></select>
                </div>
              )}
              <div className="admin-actions">
                {!staff && <Button secondary small onClick={() => openModal('progress', { memo: u.memo }, { user: u, progress: ps })}>학습 상세·메모</Button>}
                {!report && !staff && <>
                  {u.status === 'pending' && <Button small onClick={() => perform('member', { id: u.id, status: 'active' }, `${u.name}님을 승인했습니다.`)}>승인</Button>}
                  <Button secondary small title="알림 보내기" onClick={() => openModal('nudge', { ids: [u.id], title: '', body: '', link: '/learn', name: u.name })}><BellRing size={14} /></Button>
                  {superAdmin && <Button secondary small title="비밀번호 재설정 링크" onClick={async () => { try { const r = await act('reset_link', { userId: u.id }); await navigator.clipboard?.writeText(r.link); setToast('재설정 링크를 복사했습니다. 교육생에게 전달해 주세요. (24시간 유효)'); } catch (e: any) { setToast(e.message); } }}><KeyRound size={14} /></Button>}
                  {superAdmin && <Button secondary small title="운영 관리자로 지정" onClick={async () => { if (await ask(`${u.name}님을 운영 관리자로 지정할까요?`, '교육 운영 기능을 사용할 수 있게 됩니다. (연동 설정·삭제·권한 변경은 제외)')) perform('member', { id: u.id, role: 'manager' }, '운영 관리자로 지정했습니다.'); }}><ShieldCheck size={14} /></Button>}
                  {superAdmin && <Button secondary small danger title="삭제" onClick={async () => { if (await ask(`${u.name}님의 계정을 삭제할까요?`, '학습 기록, 노트, 질문이 모두 삭제되며 복구할 수 없습니다.', { danger: true, confirmLabel: '삭제' })) perform('member_delete', { id: u.id }, '계정을 삭제했습니다.'); }}><Trash2 size={14} /></Button>}
                </>}
                {staff && superAdmin && !isMe && <Button secondary small danger title="계정 삭제" onClick={async () => { if (await ask(`${u.name}님의 운영진 계정을 삭제할까요?`, undefined, { danger: true, confirmLabel: '삭제' })) perform('member_delete', { id: u.id }, '계정을 삭제했습니다.'); }}><Trash2 size={14} /></Button>}
              </div>
              {reset && superAdmin && <div className="info-note small"><KeyRound size={13} /> 재설정 요청 중 · {new Date(reset.expires).toLocaleString('ko-KR')}까지 <button className="text-link" onClick={() => { navigator.clipboard?.writeText(`${location.origin}/reset/${reset.token}`); setToast('재설정 링크를 복사했습니다.'); }}><Copy size={12} /> 링크 복사</button></div>}
            </div>
          );
        })}
      </div>
      {!list.length && <Empty title={status === 'staff' ? '운영진이 없어요' : '교육생을 찾을 수 없어요'} description={status === 'staff' ? '교육생 카드의 방패 버튼으로 운영 관리자를 지정할 수 있어요.' : '교육 가입 신청이 접수되면 이곳에서 확인할 수 있습니다.'} />}
    </>
  );
}

const KIND_LABEL: Record<string, string> = { login: '로그인', lesson_complete: '강의 완료', quiz: '퀴즈 응시', question: '질문 등록', submit: '과제 제출', certificate: '수료', reply: '질문 답변', member_status: '교육생 상태 변경', member_role: '역할 변경', course_delete: '과정 삭제', lesson_delete: '강의 삭제', review_submission: '과제 검토', password_reset: '비밀번호 재설정', member_delete: '계정 삭제', nudge: '알림 발송' };
export { KIND_LABEL };

export function AdminActivity() {
  const { data } = useEdu();
  const [kind, setKind] = useState('all');
  const [search, setSearch] = useState('');
  if (!data) return null;
  const list = (data.activity ?? []).filter((a) => (kind === 'all' || a.kind === kind) && (!search || a.name.includes(search) || a.detail.includes(search)));
  const kinds = Array.from(new Set((data.activity ?? []).map((a) => a.kind)));
  return (
    <>
      <PageHead title="활동 로그" sub="교육생의 학습 활동과 운영진의 관리 작업을 시간순으로 확인하세요." action={<Button small secondary onClick={() => downloadCsv('sellerbricks-activity.csv', [['시각', '이름', '활동', '내용'], ...list.map((a) => [a.created, a.name, KIND_LABEL[a.kind] || a.kind, a.detail])])}><Download size={15} /> CSV</Button>} />
      <div className="filter-row">
        <select value={kind} onChange={(e) => setKind(e.target.value)} aria-label="활동 종류"><option value="all">모든 활동</option>{kinds.map((k) => <option key={k} value={k}>{KIND_LABEL[k] || k}</option>)}</select>
        <div className="search"><Search size={17} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="이름·내용 검색" aria-label="활동 검색" /></div>
      </div>
      <div className="panel">
        {list.length ? <ul className="activity-list">{list.map((a) => <li key={a.id}><b>{a.name}</b> {KIND_LABEL[a.kind] || a.kind}{a.detail && <span> · {a.detail}</span>}<small title={a.created}>{relTime(a.created)}</small></li>)}</ul> : <Empty title="활동 기록이 없어요" />}
        <p className="small-muted">최근 활동 최대 80건을 표시합니다.</p>
      </div>
    </>
  );
}
