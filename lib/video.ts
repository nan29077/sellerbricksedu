/** 영상 주소 종류 판별 — 직접 재생 파일 / HLS(.m3u8, Cloudflare Stream) / YouTube / Vimeo */
export type VideoSource = { kind: 'file' | 'hls'; url: string } | { kind: 'youtube' | 'vimeo'; id: string; url: string };

export function videoSource(url: string): VideoSource {
  const u = String(url || '').trim();
  try {
    const p = new URL(u, 'https://x.invalid');
    const host = p.hostname.replace(/^www\.|^m\./, '');
    if (host === 'youtu.be') { const id = p.pathname.slice(1).split('/')[0]; if (id) return { kind: 'youtube', id, url: u }; }
    if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
      const id = p.searchParams.get('v') || p.pathname.match(/^\/(?:embed|shorts|live)\/([\w-]{6,})/)?.[1];
      if (id) return { kind: 'youtube', id, url: u };
    }
    if (host === 'vimeo.com' || host === 'player.vimeo.com') {
      const id = p.pathname.match(/(\d{6,})/)?.[1];
      if (id) return { kind: 'vimeo', id, url: u };
    }
    if (/\.m3u8$/i.test(p.pathname) || /cloudflarestream\.com|videodelivery\.net/.test(host) && /manifest/.test(p.pathname)) return { kind: 'hls', url: u };
  } catch { /* 상대 경로 등 */ }
  return { kind: 'file', url: u };
}

const scripts: Record<string, Promise<void>> = {};
export function loadScript(src: string) {
  return (scripts[src] ||= new Promise<void>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src; s.async = true;
    s.onload = () => resolve();
    s.onerror = () => { delete scripts[src]; reject(new Error('스크립트를 불러오지 못했습니다.')); };
    document.head.appendChild(s);
  }));
}

/** YouTube IFrame API 준비 */
export async function youtubeApi(): Promise<any> {
  const w = window as any;
  if (w.YT?.Player) return w.YT;
  await new Promise<void>((resolve, reject) => {
    const prev = w.onYouTubeIframeAPIReady;
    w.onYouTubeIframeAPIReady = () => { prev?.(); resolve(); };
    loadScript('https://www.youtube.com/iframe_api').catch(reject);
    setTimeout(() => (w.YT?.Player ? resolve() : null), 3000);
  });
  return w.YT;
}

/** 관리자 화면: 영상 길이(초) 자동 감지. 실패하면 null */
export async function detectDuration(url: string): Promise<number | null> {
  const src = videoSource(url);
  try {
    if (src.kind === 'youtube') {
      const YT = await youtubeApi();
      const host = document.createElement('div');
      host.style.cssText = 'position:fixed;left:-9999px;width:200px;height:120px';
      const inner = document.createElement('div');
      host.appendChild(inner); document.body.appendChild(host);
      return await new Promise<number | null>((resolve) => {
        const done = (v: number | null) => { try { p.destroy(); } catch {} host.remove(); resolve(v); };
        const p = new YT.Player(inner, { videoId: src.id, playerVars: { mute: 1 }, events: { onReady: () => { const d = p.getDuration(); if (d) done(Math.round(d)); else { p.mute(); p.playVideo(); setTimeout(() => done(Math.round(p.getDuration()) || null), 2500); } }, onError: () => done(null) } });
        setTimeout(() => done(null), 12000);
      });
    }
    if (src.kind === 'vimeo') {
      const r = await fetch('https://vimeo.com/api/oembed.json?url=' + encodeURIComponent('https://vimeo.com/' + src.id));
      const j: any = await r.json();
      return Math.round(j.duration) || null;
    }
    if (src.kind === 'hls') {
      const v = document.createElement('video');
      v.muted = true;
      if (v.canPlayType('application/vnd.apple.mpegurl')) v.src = src.url;
      else { const { default: Hls } = await import('hls.js'); const h = new Hls(); h.loadSource(src.url); h.attachMedia(v); }
      return await new Promise((resolve) => { v.onloadedmetadata = () => resolve(Number.isFinite(v.duration) ? Math.round(v.duration) : null); v.onerror = () => resolve(null); setTimeout(() => resolve(null), 12000); });
    }
    const v = document.createElement('video');
    v.preload = 'metadata'; v.src = src.url;
    return await new Promise((resolve) => { v.onloadedmetadata = () => resolve(Number.isFinite(v.duration) ? Math.round(v.duration) : null); v.onerror = () => resolve(null); setTimeout(() => resolve(null), 12000); });
  } catch {
    return null;
  }
}
