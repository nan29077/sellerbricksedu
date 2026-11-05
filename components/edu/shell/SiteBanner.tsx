'use client';
import { useState } from 'react';
import { Megaphone, X, ArrowRight } from 'lucide-react';
import { useEdu } from '../../../lib/edu-store';

const KEY = 'edu_banner_closed';
const hash = (t: string) => { let h = 0; for (let i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) | 0; return String(h); };

/** 관리자 설정의 사이트 상단 공지 배너 (문구가 바뀌면 다시 표시) */
export function SiteBanner() {
  const { data, go } = useEdu();
  const s = data?.settings ?? {};
  const text = (s.banner_text || '').trim();
  const id = hash(text + '|' + (s.banner_link || ''));
  const [closed, setClosed] = useState<string | null>(() => { try { return localStorage.getItem(KEY); } catch { return null; } });
  if (s.banner_on !== '1' || !text || closed === id) return null;
  const link = s.banner_link || '';
  const open = () => { if (!link) return; if (link.startsWith('/')) go(link); else window.open(link, '_blank', 'noopener'); };
  return (
    <div className={'site-banner tone-' + (s.banner_tone || 'info')} role="region" aria-label="사이트 공지">
      <div className="site-banner-inner">
        <Megaphone size={16} />
        {link ? <button className="site-banner-text" onClick={open}>{text} <ArrowRight size={14} /></button> : <span className="site-banner-text">{text}</span>}
        <button className="site-banner-close" aria-label="공지 닫기" onClick={() => { setClosed(id); try { localStorage.setItem(KEY, id); } catch { /* 저장 불가 환경 */ } }}><X size={16} /></button>
      </div>
    </div>
  );
}
