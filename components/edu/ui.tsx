'use client';
import { BookOpen, Star, X, CheckCircle2, AlertCircle, Info, RefreshCw, type LucideIcon } from 'lucide-react';
import { Component, useEffect, useRef, useState, type ReactNode, type CSSProperties, type ErrorInfo } from 'react';
import { useEdu } from '../../lib/edu-store';
export { CharacterAvatar } from '../../app/account-settings';

export function Logo() {
  return (
    <span className="brand">
      <img src="/brand/sellerbricks-light.svg" width="192" height="41" alt="셀러브릭스" />
      <span className="brand-edu-label">EDU</span>
    </span>
  );
}

export function Button({ children, onClick, secondary = false, small = false, disabled = false, danger = false, type = 'button', className = '', title }: {
  children: ReactNode; onClick?: () => void; secondary?: boolean; small?: boolean; disabled?: boolean; danger?: boolean; type?: 'button' | 'submit'; className?: string; title?: string;
}) {
  return (
    <button type={type} title={title} onClick={onClick} disabled={disabled} className={`button ${secondary ? 'secondary' : ''} ${small ? 'small' : ''} ${danger ? 'danger' : ''} ${className}`.trim()}>
      {children}
    </button>
  );
}

export function Empty({ title, description, icon: Icon = BookOpen, action }: { title: string; description?: string; icon?: LucideIcon; action?: ReactNode }) {
  return (
    <div className="empty">
      <Icon size={34} />
      <h3>{title}</h3>
      {description && <p>{description}</p>}
      {action}
    </div>
  );
}

export function PageHead({ title, sub, action }: { title: string; sub?: string; action?: ReactNode }) {
  const { admin } = useEdu();
  return (
    <div className="page-head">
      <div>
        <span className="eyebrow">{admin ? '셀러브릭스 에듀 · 관리자' : '셀러브릭스 에듀 · 나의 학습'}</span>
        <h1>{title}</h1>
        {sub && <p>{sub}</p>}
      </div>
      {action}
    </div>
  );
}

export function Pill({ children, tone = '', className = '' }: { children: ReactNode; tone?: '' | 'good' | 'warn' | 'bad' | 'info'; className?: string }) {
  return <span className={`pill ${tone} ${className}`.trim()}>{children}</span>;
}

export function ProgressBar({ value, label, small = false }: { value: number; label?: ReactNode; small?: boolean }) {
  return (
    <>
      {label !== undefined && (
        <div className="progress-label">
          <span>{label}</span>
          <b>{value}%</b>
        </div>
      )}
      <div className={'progress-track ' + (small ? 'small' : '')} role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
        <i style={{ width: value + '%' }} />
      </div>
    </>
  );
}

export function StatCard({ icon: Icon, label, value, sub }: { icon: LucideIcon; label: string; value: ReactNode; sub?: string }) {
  return (
    <div className="stat-card">
      <span><Icon size={22} /></span>
      <p>{label}</p>
      <b>{value}</b>
      {sub && <small>{sub}</small>}
    </div>
  );
}

export function Stars({ value, size = 16, onChange }: { value: number; size?: number; onChange?: (v: number) => void }) {
  return (
    <span className={'stars ' + (onChange ? 'editable' : '')} aria-label={`${value.toFixed(1)}점`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <button key={i} type="button" disabled={!onChange} onClick={() => onChange?.(i)} aria-label={`${i}점`}>
          <Star size={size} fill={i <= Math.round(value) ? 'currentColor' : 'none'} />
        </button>
      ))}
    </span>
  );
}

export function Tabs<T extends string>({ items, value, onChange }: { items: [T, string][] | T[]; value: T; onChange: (v: T) => void }) {
  const list = (items as any[]).map((i) => (Array.isArray(i) ? i : [i, i])) as [T, string][];
  return (
    <div className="tabs" role="tablist">
      {list.map(([v, n]) => (
        <button key={v} role="tab" aria-selected={value === v} className={value === v ? 'selected' : ''} onClick={() => onChange(v)}>{n}</button>
      ))}
    </div>
  );
}

export function Modal({ title, wide = false, children, onClose }: { title: string; wide?: boolean; children: ReactNode; onClose: () => void }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    // 첫 입력에 포커스, 배경 스크롤 잠금
    const el = ref.current?.querySelector<HTMLElement>('input:not([type=hidden]):not([type=checkbox]):not([type=radio]), textarea, select');
    el?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section ref={ref} role="dialog" aria-modal="true" aria-label={title} className={'modal ' + (wide ? 'wide' : '')} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button type="button" onClick={onClose} aria-label="닫기"><X /></button>
        </div>
        {children}
      </section>
    </div>
  );
}

export function Toast() {
  const { toast, setToast } = useEdu();
  if (!toast) return null;
  const Icon = toast.tone === 'error' ? AlertCircle : toast.tone === 'info' ? Info : CheckCircle2;
  return (
    <div className={'toast ' + toast.tone} role={toast.tone === 'error' ? 'alert' : 'status'}>
      <Icon size={18} />
      {toast.text}
      <button onClick={() => setToast('')} aria-label="알림 닫기"><X size={17} /></button>
    </div>
  );
}

/** 화면 일부에서 오류가 나도 앱 전체가 멈추지 않도록 감싼다. */
export class ErrorBoundary extends Component<{ children: ReactNode; resetKey?: string }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error('화면 오류', error, info.componentStack); }
  componentDidUpdate(prev: { resetKey?: string }) { if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null }); }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="empty error-box" role="alert">
        <AlertCircle size={34} />
        <h3>화면을 표시하는 중 문제가 생겼어요</h3>
        <p>{this.state.error.message}</p>
        <button className="button secondary small" onClick={() => this.setState({ error: null })}><RefreshCw size={14} /> 다시 시도</button>
      </div>
    );
  }
}

export function Field({ label, children, hint, style }: { label: ReactNode; children: ReactNode; hint?: string; style?: CSSProperties }) {
  return (
    <label style={style}>
      {label}
      {children}
      {hint && <small className="field-hint">{hint}</small>}
    </label>
  );
}

export function Ring({ value, size = 72, stroke = 7, children }: { value: number; size?: number; stroke?: number; children?: ReactNode }) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(100, value));
  return (
    <span className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--purple)" strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - v / 100)} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      </svg>
      <span className="ring-label">{children ?? `${v}%`}</span>
    </span>
  );
}

export const statusLabel: Record<string, string> = { active: '학습 가능', pending: '승인 대기', suspended: '이용 중지' };
export const statusTone: Record<string, 'good' | 'warn' | 'bad'> = { active: 'good', pending: 'warn', suspended: 'bad' };

/** 긴 목록을 단계적으로 보여준다. 반환: [보이는 항목, 더보기 버튼(없으면 null)] */
export function useLimit<T>(items: T[], step = 24): [T[], ReactNode] {
  const [limit, setLimit] = useState(step);
  const visible = items.slice(0, limit);
  const more = items.length > limit ? (
    <div className="load-more"><button className="button secondary small" onClick={() => setLimit((n) => n + step)}>더 보기 ({items.length - limit}개 남음)</button></div>
  ) : null;
  return [visible, more];
}
