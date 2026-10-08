'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Course, Lesson, Payload, Progress, User } from './types';
import { isStaff } from './constants';

export type ModalState = { type: string; [k: string]: any } | null;
export type ConfirmState = { title: string; body?: string; danger?: boolean; confirmLabel?: string; resolve: (ok: boolean) => void } | null;
export type ToastState = { text: string; tone: 'success' | 'error' | 'info' } | null;

interface Store {
  path: string;
  data: Payload | null;
  error: string;
  busy: boolean;
  refreshing: boolean;
  toast: ToastState;
  modal: ModalState;
  editor: any;
  mobile: boolean;
  confirm: ConfirmState;
  user: User | null;
  admin: boolean;
  superAdmin: boolean;
  courses: Course[];
  lessons: Lesson[];
  progress: Progress[];
  go: (p: string, opts?: { replace?: boolean }) => void;
  load: () => Promise<Payload | undefined>;
  act: (action: string, extra?: any, quiet?: boolean) => Promise<any>;
  perform: (action: string, extra?: any, success?: string) => Promise<any>;
  /** 서버 응답을 기다리지 않고 로컬 데이터를 먼저 바꾼다(낙관적 업데이트). */
  patch: (fn: (d: Payload) => Payload) => void;
  setToast: (t: string | ToastState, tone?: 'success' | 'error' | 'info') => void;
  setModal: (m: ModalState) => void;
  setEditor: (e: any) => void;
  setMobile: (m: boolean) => void;
  setBusy: (b: boolean) => void;
  openModal: (type: string, editor?: any, extra?: Record<string, any>) => void;
  closeModal: () => Promise<void>;
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
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToastState] = useState<ToastState>(null);
  const [modal, setModal] = useState<ModalState>(null);
  const [editor, setEditor] = useState<any>({});
  const [mobile, setMobile] = useState(false);
  const [confirm, setConfirm] = useState<ConfirmState>(null);
  const loading = useRef<Promise<any> | null>(null);
  const etag = useRef<string>('');
  const modalInitial = useRef<string>('');

  const setToast = useCallback((t: string | ToastState, tone: 'success' | 'error' | 'info' = 'success') => {
    if (!t) return setToastState(null);
    setToastState(typeof t === 'string' ? { text: t, tone } : t);
  }, []);

  const load = useCallback(async () => {
    if (loading.current) return loading.current;
    loading.current = (async () => {
      setRefreshing(true);
      try {
        const r = await fetch('/api/edu', { cache: 'no-store', credentials: 'same-origin', headers: etag.current ? { 'If-None-Match': etag.current } : {} });
        if (r.status === 304) return data ?? undefined; // 변경 없음
        const j: any = await r.json();
        if (!r.ok) throw Error(j.error);
        etag.current = r.headers.get('ETag') || '';
        setData(j);
        setError('');
        return j as Payload;
      } catch (e: any) {
        setError(e.message || '불러오지 못했습니다.');
        return undefined;
      } finally {
        loading.current = null;
        setRefreshing(false);
      }
    })();
    return loading.current;
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    // 알림·답변 등 관리자↔교육생 간 변경 사항을 주기적으로 동기화 (ETag로 변경 없으면 304)
    const poll = setInterval(() => { if (document.visibilityState === 'visible') load(); }, 60000);
    return () => {
      clearInterval(poll);
      window.removeEventListener('popstate', fn);
      document.removeEventListener('visibilitychange', vis);
    };
  }, [load]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToastState(null), toast.tone === 'error' ? 6000 : 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const go = useCallback((p: string, opts?: { replace?: boolean }) => {
    if (opts?.replace) history.replaceState({}, '', p);
    else history.pushState({}, '', p);
    setPath(p);
    setMobile(false);
    window.scrollTo({ top: 0 });
  }, []);

  const act = useCallback(
    async (action: string, extra: any = {}, quiet = false) => {
      if (!quiet) setBusy(true);
      try {
        const r = await fetch('/api/edu', { method: 'POST', credentials: 'same-origin', cache: 'no-store', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, ...extra }) });
        const j: any = await r.json().catch(() => ({ error: '응답을 읽지 못했습니다.' }));
        if (!r.ok) throw Error(j.error || `요청 실패 (${r.status})`);
        if (!quiet && !['ai', 'quiz', 'logout'].includes(action)) await load();
        return j;
      } catch (e: any) {
        if (quiet) {
          setToast(e.message, 'error');
          return null;
        }
        throw e;
      } finally {
        if (!quiet) setBusy(false);
      }
    },
    [load, setToast],
  );

  const perform = useCallback(
    async (action: string, extra: any = {}, success = '저장되었습니다.') => {
      try {
        const j = await act(action, extra);
        if (j) {
          if (success) setToast(success, 'success');
          setModal(null);
          modalInitial.current = '';
        }
        return j;
      } catch (e: any) {
        setToast(e.message, 'error');
        return null;
      }
    },
    [act, setToast],
  );

  const patch = useCallback((fn: (d: Payload) => Payload) => setData((d) => (d ? fn(d) : d)), []);

  const ask = useCallback((title: string, body?: string, opts?: { danger?: boolean; confirmLabel?: string }) => new Promise<boolean>((resolve) => setConfirm({ title, body, ...opts, resolve })), []);
  const openModal = useCallback((type: string, ed: any = {}, extra: Record<string, any> = {}) => {
    setEditor(ed);
    modalInitial.current = JSON.stringify(ed);
    setModal({ type, ...extra });
  }, []);
  /** 편집 중인 내용이 있으면 확인 후 닫기 */
  const closeModal = useCallback(async () => {
    const editable = ['course', 'lesson', 'post', 'announcement', 'assignment', 'event', 'path', 'faq', 'cohort', 'channel', 'reply', 'import', 'nudge'];
    if (modal && editable.includes(modal.type) && modalInitial.current && JSON.stringify(editor) !== modalInitial.current) {
      if (!(await ask('작성 중인 내용을 닫을까요?', '저장하지 않은 변경 사항이 사라집니다.', { danger: true, confirmLabel: '닫기' }))) return;
    }
    setModal(null);
    modalInitial.current = '';
  }, [modal, editor, ask]);

  // Escape 로 확인창/모달 닫기
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (confirm) { confirm.resolve(false); setConfirm(null); return; }
      if (modal) closeModal();
    };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [confirm, modal, closeModal]);

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
    path, data, error, busy, refreshing, toast, modal, editor, mobile, confirm,
    user, admin: isStaff(user?.role), superAdmin: user?.role === 'admin', courses, lessons, progress,
    go, load, act, perform, patch, setToast, setModal, setEditor, setMobile, setBusy, openModal, closeModal, ask,
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
              <button type="button" autoFocus className={'button ' + (confirm.danger ? 'danger' : '')} onClick={() => { confirm.resolve(true); setConfirm(null); }}>{confirm.confirmLabel || '확인'}</button>
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
