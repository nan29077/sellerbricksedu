'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { MonitorPlay, Gauge, PictureInPicture2, Keyboard, ListVideo, RotateCcw } from 'lucide-react';
import { useEdu } from '../../../lib/edu-store';
import { fmt } from '../../../lib/learning';
import type { Lesson } from '../../../lib/types';
import { Button } from '../ui';

const SPEEDS = [0.75, 1, 1.25, 1.5, 1.75, 2];

export interface PlayerApi { seek: (t: number) => void; currentTime: () => number }

export function Player({ lesson, startAt, onWatched, onEnded, onReady, nextLessonId }: {
  lesson: Lesson; startAt: number; onWatched: (delta: number, position: number) => void; onEnded: () => void; onReady?: (api: PlayerApi) => void; nextLessonId?: string;
}) {
  const { admin, go, act, user } = useEdu();
  const cb = useRef({ onWatched, onEnded });
  useEffect(() => { cb.current = { onWatched, onEnded }; });
  const video = useRef<HTMLVideoElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const tick = useRef(0), elapsed = useRef(0), lastSent = useRef(0);
  const [speed, setSpeed] = useState(() => { try { const s = Number(localStorage.getItem('edu_speed')); return SPEEDS.includes(s) ? s : 1; } catch { return 1; } });
  const [time, setTime] = useState(0);
  const [showChapters, setShowChapters] = useState(true);
  const [showKeys, setShowKeys] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [resumed, setResumed] = useState(false);

  const flush = useCallback(() => {
    const v = video.current;
    if (!v || elapsed.current <= 0) return;
    const delta = Math.min(elapsed.current, 15);
    elapsed.current = 0;
    cb.current.onWatched(delta, v.currentTime);
  }, []);

  // 재생 추적: 실제 재생된 구간만 누적, 5초마다 서버 전송
  function track() {
    const v = video.current;
    if (!v) return;
    setTime(v.currentTime);
    const now = performance.now();
    if (tick.current) {
      const d = (now - tick.current) / 1000;
      // 배속으로 본 만큼 콘텐츠 시간으로 인정 (최대 2배)
      if (d > 0 && d < 1.5 && !v.seeking && !v.paused) elapsed.current += d * Math.min(v.playbackRate, 2);
    }
    tick.current = now;
    if (now - lastSent.current > 5000) {
      lastSent.current = now;
      flush();
    }
  }

  useEffect(() => {
    onReady?.({ seek: (t) => { if (video.current) { video.current.currentTime = t; video.current.play().catch(() => {}); } }, currentTime: () => video.current?.currentTime || 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lesson.id]);
  useEffect(() => { if (video.current) video.current.playbackRate = speed; try { localStorage.setItem('edu_speed', String(speed)); } catch {} }, [speed]);
  useEffect(() => () => flush(), [flush]);

  // 자동 다음 강의 카운트다운
  useEffect(() => {
    if (countdown === null) return;
    if (countdown <= 0) { if (nextLessonId) go('/lesson/' + nextLessonId); return; }
    const t = setTimeout(() => setCountdown(countdown - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown, nextLessonId, go]);

  // 단축키
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      const v = video.current;
      if (!v) return;
      const target = e.target as HTMLElement;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable) return;
      const k = e.key.toLowerCase();
      if (k === ' ' || k === 'k') { e.preventDefault(); if (v.paused) v.play(); else v.pause(); }
      else if (k === 'arrowleft' || k === 'j') { e.preventDefault(); v.currentTime = Math.max(0, v.currentTime - (k === 'j' ? 10 : 5)); }
      else if (k === 'arrowright' || k === 'l') { e.preventDefault(); v.currentTime = Math.min(v.duration || lesson.duration, v.currentTime + (k === 'l' ? 10 : 5)); }
      else if (k === 'arrowup') { e.preventDefault(); v.volume = Math.min(1, v.volume + 0.1); }
      else if (k === 'arrowdown') { e.preventDefault(); v.volume = Math.max(0, v.volume - 0.1); }
      else if (k === 'm') v.muted = !v.muted;
      else if (k === 'f') { if (document.fullscreenElement) document.exitFullscreen(); else wrap.current?.requestFullscreen?.(); }
      else if (k === '>' || k === '.') setSpeed((s) => SPEEDS[Math.min(SPEEDS.length - 1, SPEEDS.indexOf(s) + 1)]);
      else if (k === '<' || k === ',') setSpeed((s) => SPEEDS[Math.max(0, SPEEDS.indexOf(s) - 1)]);
      else if (k === 'c') setShowChapters((s) => !s);
      else if (k === '?') setShowKeys((s) => !s);
    };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [lesson.duration]);

  if (!lesson.video) {
    return (
      <div className="player-box">
        <div className="video-empty">
          <MonitorPlay size={48} />
          <h2>교육 영상 등록 예정</h2>
          <p>관리자가 영상을 등록하면 이곳에서 학습할 수 있어요.</p>
          {admin && <Button secondary small onClick={() => go('/admin/videos')}>영상 등록하기</Button>}
        </div>
      </div>
    );
  }

  const current = lesson.chapters.filter((c) => c.at <= time).slice(-1)[0];
  return (
    <div className="player-shell">
      <div className="player-box" ref={wrap}>
        <video
          key={lesson.id}
          ref={video}
          controls
          playsInline
          preload="metadata"
          src={lesson.video}
          onLoadedMetadata={() => { const v = video.current!; v.playbackRate = speed; if (startAt > 3 && startAt < (v.duration || lesson.duration) - 3) { v.currentTime = startAt; setResumed(true); } }}
          onTimeUpdate={track}
          onPlay={() => { tick.current = performance.now(); setCountdown(null); }}
          onPause={() => { flush(); tick.current = 0; }}
          onSeeking={() => { tick.current = 0; }}
          onRateChange={() => { const r = video.current?.playbackRate; if (r && SPEEDS.includes(r)) setSpeed(r); }}
          onEnded={async () => { flush(); tick.current = 0; await cb.current.onEnded(); if (nextLessonId) setCountdown(8); }}
        />
        {resumed && <button className="player-resume" onClick={() => { video.current!.currentTime = 0; setResumed(false); }}><RotateCcw size={14} /> {fmt(startAt)}부터 이어보기 중 · 처음부터</button>}
        {countdown !== null && (
          <div className="player-next">
            <p>다음 강의가 {countdown}초 후 시작됩니다</p>
            <div><Button small onClick={() => go('/lesson/' + nextLessonId)}>지금 이동</Button><Button small secondary onClick={() => setCountdown(null)}>취소</Button></div>
          </div>
        )}
      </div>
      <div className="player-toolbar">
        <div className="speed">
          <Gauge size={16} />
          {SPEEDS.map((s) => <button key={s} className={speed === s ? 'selected' : ''} onClick={() => setSpeed(s)} aria-pressed={speed === s}>{s}x</button>)}
        </div>
        <div className="player-tools">
          {current && <span className="chapter-now"><ListVideo size={14} /> {current.title}</span>}
          {lesson.chapters.length > 0 && <button onClick={() => setShowChapters(!showChapters)} aria-pressed={showChapters}><ListVideo size={16} /> 챕터</button>}
          {'pictureInPictureEnabled' in document && <button onClick={() => { const v = video.current!; if ((document as any).pictureInPictureElement) (document as any).exitPictureInPicture(); else (v as any).requestPictureInPicture?.(); }}><PictureInPicture2 size={16} /> PiP</button>}
          <button onClick={() => setShowKeys(!showKeys)} aria-pressed={showKeys}><Keyboard size={16} /> 단축키</button>
        </div>
      </div>
      {showKeys && (
        <div className="keys-help">
          {[['Space / K', '재생·일시정지'], ['← →', '5초 이동'], ['J / L', '10초 이동'], ['↑ ↓', '음량'], ['M', '음소거'], ['F', '전체 화면'], ['< >', '배속'], ['C', '챕터 보기']].map(([k, d]) => <span key={k}><kbd>{k}</kbd>{d}</span>)}
        </div>
      )}
      {showChapters && lesson.chapters.length > 0 && (
        <ol className="chapters">
          {lesson.chapters.map((c, i) => {
            const end = lesson.chapters[i + 1]?.at ?? lesson.duration;
            const active = time >= c.at && time < end;
            return (
              <li key={i}>
                <button className={active ? 'active' : ''} onClick={() => { const v = video.current!; v.currentTime = c.at; v.play().catch(() => {}); if (user) act('progress', { lessonId: lesson.id, position: c.at, delta: 0 }, true); }}>
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
