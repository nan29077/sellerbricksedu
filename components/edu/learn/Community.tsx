'use client';
import { useState } from 'react';
import { Plus, Users, Search } from 'lucide-react';
import { useEdu } from '../../../lib/edu-store';
import { PLATFORMS, platformMark, platformName } from '../../../lib/learning';
import { Button, CharacterAvatar, Empty, PageHead, Pill, Tabs } from '../ui';

export function CommunityPage() {
  const { data, user, openModal, perform, act, load, ask } = useEdu();
  const [cohortFilter, setCohortFilter] = useState('all');
  const [platform, setPlatform] = useState('all');
  const [group, setGroup] = useState<'all' | 'new' | 'existing'>('all');
  const [search, setSearch] = useState('');
  if (!data || !user) return null;
  const channels = data.channels;
  const own = channels.filter((c) => c.user_id === user.id);
  const members = new Map(channels.filter((c) => c.user_id !== user.id).map((c) => [c.user_id, c]));
  const visible = Array.from(members.values()).filter((u) =>
    (cohortFilter === 'all' || u.cohort_id === cohortFilter) &&
    (!search || u.name.includes(search) || (u.bio || '').includes(search)) &&
    (group === 'all' || (group === 'new' ? u.joined > user.created : u.joined <= user.created)) &&
    channels.some((c) => c.user_id === u.user_id && c.shared && (platform === 'all' || c.platform === platform)),
  );
  return (
    <>
      <PageHead title="셀러 채널 교류" sub="함께 배우는 셀러의 콘텐츠를 만나고, 관심 있는 채널을 찾아보세요." action={<Button small onClick={() => openModal('channel', { platform: 'youtube', url: '', bio: '', shared: 1 })}><Plus size={16} /> 내 채널 등록</Button>} />
      <div className="community-intro"><Users size={30} /><div><h3>서로의 콘텐츠에서 영감을 얻으세요.</h3><p>채널 방문과 구독·팔로우는 각 플랫폼에서 직접 선택합니다. 방문 기록은 실제 구독 여부를 의미하지 않습니다.</p></div></div>
      <div className="panel">
        <h3>나의 공개 채널</h3>
        {own.length ? (
          <div className="own-channels">
            {own.map((c) => (
              <div key={c.platform}>
                <span className={'platform-mark ' + c.platform}>{platformMark[c.platform]}</span>
                <b>{platformName[c.platform] || c.platform}</b>
                <Pill tone={c.shared ? 'good' : ''}>{c.shared ? '공개' : '비공개'}</Pill>
                <button onClick={() => openModal('channel', c)}>수정</button>
                <button onClick={async () => { if (await ask('채널 등록을 해제할까요?')) perform('channel_remove', { platform: c.platform }, '채널 등록을 해제했습니다.'); }}>해제</button>
              </div>
            ))}
          </div>
        ) : <p className="muted">공개하고 싶은 채널을 등록하면 교육생들에게 소개됩니다. 등록은 선택 사항입니다.</p>}
      </div>
      <div className="filter-row">
        <Tabs items={[['all', '모든 셀러'], ['new', '새로 합류한 셀러'], ['existing', '먼저 시작한 셀러']]} value={group} onChange={setGroup} />
        <div className="search"><Search size={16} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="셀러 이름·소개 검색" aria-label="셀러 검색" /></div>
      </div>
      <div className="filter-row secondary">
        <select value={cohortFilter} onChange={(e) => setCohortFilter(e.target.value)} aria-label="기수 필터"><option value="all">모든 기수</option>{data.cohorts.map((c) => <option value={c.id} key={c.id}>{c.name}</option>)}</select>
        <select value={platform} onChange={(e) => setPlatform(e.target.value)} aria-label="SNS 플랫폼"><option value="all">모든 플랫폼</option>{PLATFORMS.map((p) => <option key={p} value={p}>{platformName[p]}</option>)}</select>
        <span className="small-muted">{visible.length}명</span>
      </div>
      <div className="members-grid">
        {visible.map((u) => (
          <div className="panel channel-card" key={u.user_id}>
            <div className="member-top">
              <CharacterAvatar index={u.avatar} />
              <div><h3>{u.name}</h3><p>{data.cohorts.find((c) => c.id === u.cohort_id)?.name || '기수 미배정'}</p></div>
              <Pill>{u.joined > user.created ? '새로 합류' : '함께 배우는 셀러'}</Pill>
            </div>
            <p>{u.bio || '라이브 커머스를 함께 배우는 셀러입니다.'}</p>
            {channels.filter((c) => c.user_id === u.user_id && c.shared && (platform === 'all' || c.platform === platform)).map((c) => (
              <div className="channel-link" key={c.platform}>
                <span className={'platform-mark ' + c.platform}>{platformMark[c.platform]}</span>
                <div><b>{platformName[c.platform] || c.platform}</b><small>{data.visits.some((v) => v.target_id === c.user_id && v.platform === c.platform) ? '방문한 채널' : '새로운 콘텐츠를 만나보세요'}</small></div>
                <a className="button secondary small" href={c.url} target="_blank" rel="noopener noreferrer" onClick={() => { act('visit', { targetId: c.user_id, platform: c.platform }, true).then(load); }}>채널 방문</a>
              </div>
            ))}
          </div>
        ))}
      </div>
      {!visible.length && <Empty title="공개된 셀러 채널이 아직 없어요" description="교육생이 채널 공개에 동의하고 등록하면 이곳에서 만날 수 있습니다." icon={Users} />}
    </>
  );
}
