'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Course, Lesson, Payload, Progress, User } from './types';

export type ModalState = { type: string; [k: string]: any } | null;
export type ConfirmState = { title: string; body?: string; danger?: boolean; confirmLabel?: string; resolve: (ok: boolean) => void } | null;

interface Store {
  path: string;
  data: Payload | null;
  error: string;
  busy: boolean;
  toast: string;
  modal: ModalState;
  editor: any;
  mobile: boolean;
  confirm: ConfirmState;
  user: User | null;
  admin: boolean;
  courses: Course[];
  lessons: Lesson[];
  progress: Progress[];
  go: (p: string, opts?: { replace?: boolean }) => void;
  load: () => Promise<Payload | undefined>;
  act: (action: string, extra?: any, quiet?: boolean) => Promise<any>;
  perform: (action: string, extra?: any, success?: string) => Promise<any>;
  setToast: (t: string) => void;
  setModal: (m: ModalState) => void;
  setEditor: (e: any) => void;
  setMobile: (m: boolean) => void;
  setBusy: (b: boolean) => void;
  openModal: (type: string, editor?: any, extra?: Record<string, any>) => void;
  ask: (title: string, body?: string, opts?: { danger?: boolean; confirmLabel?: string }) => Promise<boolean>;
  pfor: (lessonId: string | undefined) => Partial<Progress>;
  ls: (courseId: string | undefined) => Lesson[];
  pct: (courseId: string | undefined, ps?: Progress[]) => number;
  courseOf: (lesson: Lesson | undefined) => Course | undefined;
  unread: number;
}

const Ctx = createContext<Store | null>(null);

export function EduProvider({ children }: { children: ReactNode }) {
  const [path, setPath] = useState('/');
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');
  const [modal, setModal] = useState<ModalState>(null);
  const [editor, setEditor] = useState<any>({});
  const [mobile, setMobile] = useState(false);
  const [confirm, setConfirm] = useState<ConfirmState>(null);
  const loading = useRef<Promise<any> | null>(null);

  const load = useCallback(async () => {
    if (loading.current) return loading.current;
    loading.current = (async () => {
      try {
        const r = await fetch('/api/edu', { cache: 'no-store', credentials: 'same-origin' });
        const j: any = await r.json();
        if (!r.ok) throw Error(j.error);
        setData(j);
        setError('');
        return j as Payload;
      } catch (e: any) {
        setError(e.message || '불러오지 못했습니다.');
        return undefined;
      } finally {
        loading.current = null;
      }
    })();
    return loading.current;
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 초기 경로는 클라이언트에서만 알 수 있음
    setPath(location.pathname);
    load();
    const fn = () => {
      setPath(location.pathname);
      setMobile(false);
    };
    window.addEventListener('popstate', fn);
    const vis = () => {
      if (document.visibilityState === 'visible') load();
    };
    document.addEventListener('visibilitychange', vis);
    return () => {
      window.removeEventListener('popstate', fn);
      document.removeEventListener('visibilitychange', vis);
    };
  }, [load]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 4500);
    return () => clearTimeout(t);
  }, [toast]);

  const go = useCallback((p: string, opts?: { replace?: boolean }) => {
    if (opts?.replace) history.replaceState({}, '', p);
    else history.pushState({}, '', p);
    setPath(p);
    setMobile(false);
    window.scrollTo(0, 0);
  }, []);

  const act = useCallback(
    async (action: string, extra: any = {}, quiet = false) => {
      if (!quiet) setBusy(true);
      try {
        const r = await fetch('/api/edu', { method: 'POST', credentials: 'same-origin', cache: 'no-store', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, ...extra }) });
        const j: any = await r.json();
        if (!r.ok) throw Error(j.error);
        if (!quiet && !['ai', 'quiz', 'logout'].includes(action)) await load();
        return j;
      } catch (e: any) {
        if (quiet) {
          setToast(e.message);
          return null;
        }
        throw e;
      } finally {
        if (!quiet) setBusy(false);
      }
    },
    [load],
  );

  const perform = useCallback(
    async (action: string, extra: any = {}, success = '저장되었습니다.') => {
      try {
        const j = await act(action, extra);
        if (j) {
          if (success) setToast(success);
          setModal(null);
        }
        return j;
      } catch (e: any) {
        setToast(e.message);
        return null;
      }
    },
    [act],
  );

  const ask = useCallback((title: string, body?: string, opts?: { danger?: boolean; confirmLabel?: string }) => new Promise<boolean>((resolve) => setConfirm({ title, body, ...opts, resolve })), []);
  const openModal = useCallback((type: string, ed: any = {}, extra: Record<string, any> = {}) => {
    setEditor(ed);
    setModal({ type, ...extra });
  }, []);

  const user = data?.user ?? null;
  const courses = data?.courses ?? [];
  const lessons = data?.lessons ?? [];
  const progress = data?.progress ?? [];

  const helpers = useMemo(() => {
    const pfor = (id: string | undefined): Partial<Progress> => progress.find((p) => p.lesson_id === id) || {};
    const ls = (courseId: string | undefined) => lessons.filter((l) => l.course_id === courseId).sort((a, b) => a.position - b.position);
    const pct = (courseId: string | undefined, ps: Progress[] = progress) => {
      const items = ls(courseId);
      return items.length ? Math.round((items.filter((l) => ps.some((p) => p.lesson_id === l.id && p.complete)).length / items.length) * 100) : 0;
    };
    const courseOf = (lesson: Lesson | undefined) => courses.find((c) => c.id === lesson?.course_id);
    return { pfor, ls, pct, courseOf };
  }, [courses, lessons, progress]);

  const value: Store = {
    path, data, error, busy, toast, modal, editor, mobile, confirm,
    user, admin: user?.role === 'admin', courses, lessons, progress,
    go, load, act, perform, setToast, setModal, setEditor, setMobile, setBusy, openModal, ask,
    ...helpers,
    unread: data?.notifications?.filter((n) => !n.read).length ?? 0,
  };
  return (
    <Ctx.Provider value={value}>
      {children}
      {confirm && (
        <div className="modal-backdrop" onClick={() => { confirm.resolve(false); setConfirm(null); }}>
          <section role="alertdialog" aria-modal="true" className="modal confirm-modal" onClick={(e) => e.stopPropagation()}>
            <h2>{confirm.title}</h2>
            {confirm.body && <p className="muted">{confirm.body}</p>}
            <div className="modal-actions">
              <button type="button" className="button secondary" onClick={() => { confirm.resolve(false); setConfirm(null); }}>취소</button>
              <button type="button" className={'button ' + (confirm.danger ? 'danger' : '')} onClick={() => { confirm.resolve(true); setConfirm(null); }}>{confirm.confirmLabel || '확인'}</button>
            </div>
          </section>
        </div>
      )}
    </Ctx.Provider>
  );
}

export function useEdu() {
  const s = useContext(Ctx);
  if (!s) throw new Error('useEdu must be used within EduProvider');
  return s;
}
