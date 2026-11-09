import { useEffect, useId, useRef, type ReactNode } from 'react';

export function Card({ title, children, action, className = '' }: { title?: ReactNode; children: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <section className={`card ${className}`}>
      {(title || action) && (
        <div className="card-head">
          {title && <h2>{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: (props: { id: string; 'aria-invalid'?: boolean; 'aria-describedby'?: string }) => ReactNode;
}) {
  const id = useId();
  const descId = hint || error ? `${id}-desc` : undefined;
  return (
    <div className={`field ${error ? 'has-error' : ''}`}>
      <label htmlFor={id}>{label}</label>
      {children({ id, 'aria-invalid': error ? true : undefined, 'aria-describedby': descId })}
      {(error || hint) && (
        <div id={descId} className={error ? 'field-error' : 'field-hint'} role={error ? 'alert' : undefined}>
          {error || hint}
        </div>
      )}
    </div>
  );
}

export function Empty({ icon, children }: { icon: string; children: ReactNode }) {
  return (
    <div className="empty">
      <div className="empty-icon" aria-hidden>
        {icon}
      </div>
      <div>{children}</div>
    </div>
  );
}

export function Notice({ tone = 'info', children, onClose }: { tone?: 'info' | 'warn' | 'danger' | 'ok'; children: ReactNode; onClose?: () => void }) {
  return (
    <div className={`notice notice-${tone}`} role={tone === 'danger' ? 'alert' : 'note'}>
      <div className="notice-body">{children}</div>
      {onClose && (
        <button type="button" className="icon-btn" aria-label="Закрыть" onClick={onClose}>
          ×
        </button>
      )}
    </div>
  );
}

/** Модальное окно на базе <dialog>. */
export function Modal({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      className="modal"
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      {open && (
        <div className="modal-inner">
          <div className="modal-head">
            <h2>{title}</h2>
            <button type="button" className="icon-btn" aria-label="Закрыть" onClick={onClose}>
              ×
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}

export function ConfirmDialog({
  open,
  title,
  text,
  confirmLabel = 'Удалить',
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  text: ReactNode;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal open={open} title={title} onClose={onCancel}>
      <p>{text}</p>
      <div className="row-actions">
        <button type="button" className="btn" onClick={onCancel}>
          Отмена
        </button>
        <button type="button" className="btn btn-danger" onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}

export function Progress({ value, min, max, label }: { value: number; min: number; max: number; label: string }) {
  const pct = Math.max(0, Math.min(100, max > 0 ? (value / max) * 100 : 0));
  const minPct = max > 0 ? Math.min(100, (min / max) * 100) : 0;
  return (
    <div className="progress" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={value}>
      <div className="progress-fill" style={{ width: `${pct}%` }} />
      {min > 0 && min < max && <div className="progress-mark" style={{ left: `${minPct}%` }} />}
    </div>
  );
}

export function DayPicker({ value, onChange, label }: { value: number[]; onChange: (v: number[]) => void; label: string }) {
  const days = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
  return (
    <div className="daypicker" role="group" aria-label={label}>
      {days.map((d, i) => {
        const on = value.includes(i);
        return (
          <button
            key={d}
            type="button"
            className={`chip ${on ? 'chip-on' : ''}`}
            aria-pressed={on}
            onClick={() => onChange(on ? value.filter((x) => x !== i) : [...value, i].sort())}
          >
            {d}
          </button>
        );
      })}
    </div>
  );
}
