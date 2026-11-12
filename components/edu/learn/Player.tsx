'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { MonitorPlay, Gauge, PictureInPicture2, Keyboard, ListVideo, RotateCcw, AlertTriangle } from 'lucide-react';
import { useEdu } from '../../../lib/edu-store';
import { fmt } from '../../../lib/learning';
import { videoSource, youtubeApi, loadScript } from '../../../lib/video';
import type { Lesson } from '../../../lib/types';
import { Button } from '../ui';

const SPEEDS = [0.75, 1, 1.25, 1.5, 1.75, 2];

export interface PlayerApi { seek: (t: number) => void; currentTime: () => number }

/** 재생 엔진 공통 인터페이스 (기본 video / HLS / YouTube / Vimeo) */
interface Engine { time: () => number; duration: () => number; playing: () => boolean; rate: () => number; seek: (t: number) => void; toggle: () => void; setRate: (r: number) => void; destroy?: () => void }

/** 단축키를 받으면 안 되는 대상: 입력창·버튼·링크 등 키보드로 조작하는 요소, 열린 대화상자 */
function ignoreKey(e: KeyboardEvent) {
  if (e.ctrlKey || e.metaKey || e.altKey) return true;
  const t = e.target as HTMLElement | null;
  if (t && (['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'A', 'SUMMARY'].includes(t.tagName) || t.isContentEditable || ['button', 'tab', 'radio', 'checkbox', 'menuitem', 'option'].includes(t.getAttribute('role') || ''))) return true;
  return !!document.querySelector('.modal-backdrop');
}

export function Player({ lesson, startAt, onWatched, onEnded, onReady, nextLessonId, trackable = false }: {
  lesson: Lesson; startAt: number; onWatched: (delta: number, position: number) => void; onEnded: () => void; onReady?: (api: PlayerApi) => void; nextLessonId?: string; trackable?: boolean;
}) {
  const { admin, go, act, user } = useEdu();
  const cb = useRef({ onWatched, onEnded });
  useEffect(() => { cb.current = { onWatched, onEnded }; });
  const src = videoSource(lesson.video);
  const native = src.kind === 'file' || src.kind === 'hls';
  const video = useRef<HTMLVideoElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const engine = useRef<Engine | null>(null);
  const elapsed = useRef(0), lastSent = useRef(0), lastTick = useRef(0), lastT = useRef(0), position = useRef(0), endedOnce = useRef(false);
  const [speed, setSpeed] = useState(() => { try { const s = Number(localStorage.getItem('edu_speed')); return SPEEDS.includes(s) ? s : 1; } catch { return 1; } });
  const [time, setTime] = useState(0);
  const [realDuration, setRealDuration] = useState(0);
  const [showChapters, setShowChapters] = useState(true);
  const [showKeys, setShowKeys] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [resumed, setResumed] = useState(false);
  const [failed, setFailed] = useState('');

  /** 누적 시청 시간을 서버로 보낸다 (최대 15초씩) */
  const flush = useCallback(() => {
    if (elapsed.current <= 0) return;
    const delta = Math.min(elapsed.current, 15);
    elapsed.current = Math.max(0, elapsed.current - delta);
    cb.current.onWatched(delta, position.current);
  }, []);

  const handleEnded = useCallback(async () => {
    if (endedOnce.current) return;
    endedOnce.current = true;
    flush(); lastTick.current = 0;
    await cb.current.onEnded();
    if (nextLessonId) setCountdown(8);
  }, [flush, nextLessonId]);

  // 재생 추적: 실제로 앞으로 재생된 구간만(탐색·정지 제외, 최대 2배속) 누적, 5초마다 전송
  useEffect(() => {
    const id = setInterval(() => {
      const e = engine.current;
      if (!e) return;
      const t = e.time();
      position.current = t;
      setTime(t);
      const now = performance.now();
      if (e.playing() && lastTick.current) {
        const d = (now - lastTick.current) / 1000;
        const moved = t - lastT.current;
        const cap = d * Math.min(e.rate(), 2);
        if (d > 0 && d < 3 && moved > 0 && moved <= cap + 0.75) elapsed.current += Math.min(moved, cap);
      }
      lastTick.current = e.playing() ? now : 0;
      lastT.current = t;
      if (e.playing()) endedOnce.current = false;
      if (now - lastSent.current > 5000) { lastSent.current = now; flush(); }
    }, 500);
    return () => clearInterval(id);
  }, [flush]);

  // 화면 이동·탭 닫기 직전 남은 시청 기록 전송 (sendBeacon 은 페이지가 닫혀도 전달됨)
  useEffect(() => {
    if (!trackable) return;
    const send = () => {
      if (elapsed.current <= 0) return;
      const body = JSON.stringify({ action: 'progress', lessonId: lesson.id, position: position.current, delta: Math.min(elapsed.current, 15) });
      elapsed.current = 0;
      try { navigator.sendBeacon?.('/api/edu', new Blob([body], { type: 'application/json' })); } catch { /* 무시 */ }
    };
    const vis = () => { if (document.visibilityState === 'hidden') send(); };
    window.addEventListener('pagehide', send);
    document.addEventListener('visibilitychange', vis);
    return () => { window.removeEventListener('pagehide', send); document.removeEventListener('visibilitychange', vis); flush(); };
  }, [trackable, lesson.id, flush]);

  // 재생 엔진 연결
  useEffect(() => {
    let disposed = false;
    endedOnce.current = false; // 상태(failed·resumed)는 강의마다 컴포넌트가 새로 만들어지므로 초기화 불필요
    const resume = (seek: (t: number) => void, dur: number) => { if (startAt > 3 && startAt < (dur || lesson.duration) - 3) { seek(startAt); setResumed(true); } };
    if (native) {
      const v = video.current;
      if (!v) return;
      let hls: any = null;
      engine.current = { time: () => v.currentTime, duration: () => v.duration || 0, playing: () => !v.paused && !v.ended && !v.seeking, rate: () => v.playbackRate, seek: (t) => { v.currentTime = t; v.play().catch(() => {}); }, toggle: () => { if (v.paused) v.play().catch(() => {}); else v.pause(); }, setRate: (r) => { v.playbackRate = r; } };
      if (src.kind === 'hls' && !v.canPlayType('application/vnd.apple.mpegurl')) {
        import('hls.js').then(({ default: Hls }) => {
          if (disposed) return;
          if (!Hls.isSupported()) { setFailed('이 브라우저는 스트리밍 영상을 지원하지 않습니다.'); return; }
          hls = new Hls(); hls.loadSource(src.url); hls.attachMedia(v);
          hls.on(Hls.Events.ERROR, (_: any, d: any) => { if (d.fatal) setFailed('스트리밍 영상을 불러오지 못했습니다.'); });
        }).catch(() => setFailed('스트리밍 재생기를 불러오지 못했습니다.'));
      } else v.src = src.url;
      v.onloadedmetadata = () => { v.playbackRate = speed; setRealDuration(v.duration || 0); resume((t) => { v.currentTime = t; }, v.duration); };
      v.onended = () => { handleEnded(); };
      v.onplay = () => setCountdown(null);
      v.onratechange = () => { const r = v.playbackRate; if (SPEEDS.includes(r)) setSpeed(r); };
      v.onerror = () => setFailed('영상을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.');
      return () => { disposed = true; hls?.destroy(); v.onloadedmetadata = v.onended = v.onplay = v.onratechange = v.onerror = null; engine.current = null; };
    }
    if (src.kind === 'youtube') {
      const host = document.createElement('div');
      frame.current?.appendChild(host);
      let p: any = null;
      youtubeApi().then((YT) => {
        if (disposed) return;
        p = new YT.Player(host, {
          videoId: src.id, width: '100%', height: '100%',
          playerVars: { rel: 0, modestbranding: 1, playsinline: 1, cc_load_policy: 0, start: 0 },
          events: {
            onReady: () => { setRealDuration(p.getDuration() || 0); try { p.setPlaybackRate(speed); } catch {} resume((t) => p.seekTo(t, true), p.getDuration()); },
            onStateChange: (ev: any) => { if (ev.data === 0) handleEnded(); if (ev.data === 1) { setCountdown(null); setRealDuration(p.getDuration() || 0); } },
            onPlaybackRateChange: (ev: any) => { if (SPEEDS.includes(ev.data)) setSpeed(ev.data); },
            onError: () => setFailed('YouTube 영상을 재생할 수 없습니다. 공개 범위(공개·일부 공개)와 퍼가기 허용을 확인해 주세요.'),
          },
        });
        engine.current = { time: () => p?.getCurrentTime?.() || 0, duration: () => p?.getDuration?.() || 0, playing: () => p?.getPlayerState?.() === 1, rate: () => p?.getPlaybackRate?.() || 1, seek: (t) => { p.seekTo(t, true); p.playVideo(); }, toggle: () => (p.getPlayerState() === 1 ? p.pauseVideo() : p.playVideo()), setRate: (r) => { try { p.setPlaybackRate(r); } catch {} } };
      }).catch(() => setFailed('YouTube 재생기를 불러오지 못했습니다. 네트워크를 확인해 주세요.'));
      return () => { disposed = true; try { p?.destroy(); } catch {} host.remove(); engine.current = null; };
    }
    // Vimeo
    const iframe = document.createElement('iframe');
    iframe.src = `https://player.vimeo.com/video/${src.kind === 'vimeo' ? src.id : ''}?dnt=1&playsinline=1`;
    iframe.allow = 'autoplay; fullscreen; picture-in-picture';
    iframe.allowFullscreen = true;
    iframe.title = lesson.title;
    frame.current?.appendChild(iframe);
    let p: any = null;
    const st = { t: 0, playing: false, rate: 1, dur: 0 };
    loadScript('https://player.vimeo.com/api/player.js').then(() => {
      if (disposed) return;
      p = new (window as any).Vimeo.Player(iframe);
      p.on('timeupdate', (d: any) => { st.t = d.seconds; st.dur = d.duration; });
      p.on('play', () => { st.playing = true; setCountdown(null); });
      p.on('pause', () => { st.playing = false; });
      p.on('ended', () => { st.playing = false; handleEnded(); });
      p.on('playbackratechange', (d: any) => { st.rate = d.playbackRate; if (SPEEDS.includes(d.playbackRate)) setSpeed(d.playbackRate); });
      p.getDuration().then((d: number) => { st.dur = d; setRealDuration(d); resume((t) => p.setCurrentTime(t), d); }).catch(() => {});
      engine.current = { time: () => st.t, duration: () => st.dur, playing: () => st.playing, rate: () => st.rate, seek: (t) => { p.setCurrentTime(t).then(() => p.play()).catch(() => {}); st.t = t; lastT.current = t; }, toggle: () => (st.playing ? p.pause() : p.play()).catch(() => {}), setRate: (r) => { p.setPlaybackRate(r).catch(() => {}); } };
    }).catch(() => setFailed('Vimeo 재생기를 불러오지 못했습니다.'));
    return () => { disposed = true; try { p?.destroy(); } catch {} iframe.remove(); engine.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lesson.id, lesson.video]);

  useEffect(() => {
    onReady?.({ seek: (t) => { lastT.current = t; engine.current?.seek(t); }, currentTime: () => engine.current?.time() || 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lesson.id]);
  useEffect(() => { engine.current?.setRate(speed); try { localStorage.setItem('edu_speed', String(speed)); } catch {} }, [speed]);

  // 자동 다음 강의 카운트다운
  useEffect(() => {
    if (countdown === null) return;
    if (countdown <= 0) { if (nextLessonId) go('/lesson/' + nextLessonId); return; }
    const t = setTimeout(() => setCountdown(countdown - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown, nextLessonId, go]);

  // 단축키 (입력창·버튼에 포커스가 있거나 대화상자가 열려 있으면 무시)
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      const en = engine.current;
      if (!en || ignoreKey(e)) return;
      const v = video.current;
      const k = e.key.toLowerCase();
      if (k === ' ' || k === 'k') { e.preventDefault(); en.toggle(); }
      else if (k === 'arrowleft' || k === 'j') { e.preventDefault(); const t = Math.max(0, en.time() - (k === 'j' ? 10 : 5)); lastT.current = t; en.seek(t); }
      else if (k === 'arrowright' || k === 'l') { e.preventDefault(); const t = Math.min(en.duration() || lesson.duration, en.time() + (k === 'l' ? 10 : 5)); lastT.current = t; en.seek(t); }
      else if (k === 'arrowup' && v) { e.preventDefault(); v.volume = Math.min(1, v.volume + 0.1); }
      else if (k === 'arrowdown' && v) { e.preventDefault(); v.volume = Math.max(0, v.volume - 0.1); }
      else if (k === 'm' && v) v.muted = !v.muted;
      else if (k === 'f') { if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); else wrap.current?.requestFullscreen?.().catch(() => {}); }
      else if (k === '>' || k === '.') setSpeed((s) => SPEEDS[Math.min(SPEEDS.length - 1, SPEEDS.indexOf(s) + 1)]);
      else if (k === '<' || k === ',') setSpeed((s) => SPEEDS[Math.max(0, SPEEDS.indexOf(s) - 1)]);
      else if (k === 'c') setShowChapters((s) => !s);
      else if (k === '?') setShowKeys((s) => !s);
    };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [lesson.duration]);

  if (!lesson.video || lesson.video === 'locked') {
    return (
      <div className="player-box">
        <div className="video-empty">
          <MonitorPlay size={48} />
          <h2>{lesson.video === 'locked' ? '로그인 후 시청할 수 있어요' : '교육 영상 등록 예정'}</h2>
          <p>{lesson.video === 'locked' ? '로그인하면 진도 저장과 확인 문제까지 이용할 수 있어요.' : '관리자가 영상을 등록하면 이곳에서 학습할 수 있어요.'}</p>
          {admin && !lesson.video && <Button secondary small onClick={() => go('/admin/videos')}>영상 등록하기</Button>}
        </div>
      </div>
    );
  }

  const current = lesson.chapters.filter((c) => c.at <= time).slice(-1)[0];
  const mismatch = admin && realDuration > 0 && Math.abs(realDuration - lesson.duration) / lesson.duration > 0.1;
  const externalCaptions = !!lesson.captions && /^https:\/\//.test(lesson.captions);
  return (
    <div className="player-shell">
      <div className={'player-box' + (native ? '' : ' embed')} ref={wrap}>
        {native ? (
          <video key={lesson.id} ref={video} controls playsInline preload="metadata" crossOrigin={externalCaptions ? 'anonymous' : undefined}>
            {lesson.captions && <track kind="subtitles" srcLang="ko" label="한국어 자막" src={lesson.captions} default />}
          </video>
        ) : <div className="player-embed" ref={frame} />}
        {failed && <div className="player-error" role="alert"><AlertTriangle size={18} /> {failed}</div>}
        {resumed && <button className="player-resume" onClick={() => { lastT.current = 0; engine.current?.seek(0); setResumed(false); }}><RotateCcw size={14} /> {fmt(startAt)}부터 이어보기 중 · 처음부터</button>}
        {countdown !== null && (
          <div className="player-next">
            <p>다음 강의가 {countdown}초 후 시작됩니다</p>
            <div><Button small onClick={() => go('/lesson/' + nextLessonId)}>지금 이동</Button><Button small secondary onClick={() => setCountdown(null)}>취소</Button></div>
          </div>
        )}
      </div>
      {mismatch && <div className="info-note warn small"><AlertTriangle size={14} /> 관리자 안내: 실제 영상 길이({fmt(realDuration)})가 강의 설정({fmt(lesson.duration)})과 달라요. 영상·퀴즈 관리에서 길이를 맞춰야 교육생이 기준 시청률을 채울 수 있어요.</div>}
      <div className="player-toolbar">
        <div className="speed">
          <Gauge size={16} />
          {SPEEDS.map((s) => <button key={s} className={speed === s ? 'selected' : ''} onClick={() => setSpeed(s)} aria-pressed={speed === s}>{s}x</button>)}
        </div>
        <div className="player-tools">
          {current && <span className="chapter-now"><ListVideo size={14} /> {current.title}</span>}
          {lesson.chapters.length > 0 && <button onClick={() => setShowChapters(!showChapters)} aria-pressed={showChapters}><ListVideo size={16} /> 챕터</button>}
          {native && typeof document !== 'undefined' && 'pictureInPictureEnabled' in document && <button onClick={() => { const v = video.current; if (!v) return; if ((document as any).pictureInPictureElement) (document as any).exitPictureInPicture(); else (v as any).requestPictureInPicture?.().catch(() => {}); }}><PictureInPicture2 size={16} /> PiP</button>}
          <button onClick={() => setShowKeys(!showKeys)} aria-pressed={showKeys}><Keyboard size={16} /> 단축키</button>
        </div>
      </div>
      {showKeys && (
        <div className="keys-help">
          {[['Space / K', '재생·일시정지'], ['← →', '5초 이동'], ['J / L', '10초 이동'], ...(native ? [['↑ ↓', '음량'], ['M', '음소거']] : []), ['F', '전체 화면'], ['< >', '배속'], ['C', '챕터 보기']].map(([k, d]) => <span key={k}><kbd>{k}</kbd>{d}</span>)}
        </div>
      )}
      {showChapters && lesson.chapters.length > 0 && (
        <ol className="chapters">
          {lesson.chapters.map((c, i) => {
            const end = lesson.chapters[i + 1]?.at ?? lesson.duration;
            const active = time >= c.at && time < end;
            return (
              <li key={i}>
                <button className={active ? 'active' : ''} onClick={() => { lastT.current = c.at; engine.current?.seek(c.at); if (user) act('progress', { lessonId: lesson.id, position: c.at, delta: 0 }, true); }}>
                  <span>{fmt(c.at)}</span><b>{c.title}</b><small>{fmt(end - c.at)}</small>
                </button>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
