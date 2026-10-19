import { useEffect, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { Overlay, Spinner } from './ui';

export interface ConfirmResult {
  reason: string;
  days: number;
}

interface ConfirmModalProps {
  open: boolean;
  icon: IconDefinition;
  /** 'danger' = red (cancel, ban, delete); 'warning' = amber (suspend, hide); 'primary' = brand blue. */
  tone: 'danger' | 'warning' | 'primary' | 'success';
  title: string;
  message: string;
  confirmLabel: string;
  /** Show a reason box (sent to the affected people). */
  askReason?: boolean;
  reasonRequired?: boolean;
  /** Show suspension-length choices. */
  askDays?: boolean;
  onConfirm: (result: ConfirmResult) => Promise<unknown> | void;
  onClose: () => void;
}

const GRADIENTS = {
  danger: 'linear-gradient(135deg, #ef4444, #dc2626)',
  warning: 'linear-gradient(135deg, #d97706, #f59e0b)',
  primary: 'linear-gradient(135deg, #0055d3, #1d76fa)',
  success: 'linear-gradient(135deg, #16a34a, #22c55e)',
};
const BUTTONS = { danger: 'btn-solid-danger', warning: 'btn-warning', primary: 'btn-primary', success: 'btn-success' };
const DAY_CHOICES = [1, 3, 7, 15, 30, 90];

/** The apps' glass confirmation card, over a dimmed page. Esc or the backdrop closes it. */
export function ConfirmModal(props: ConfirmModalProps) {
  const { open, icon, tone, title, message, confirmLabel, askReason, reasonRequired, askDays, onConfirm, onClose } = props;
  const [reason, setReason] = useState('');
  const [days, setDays] = useState(7);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setReason('');
    setDays(7);
    setBusy(false);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const submit = async () => {
    setBusy(true);
    try {
      await onConfirm({ reason: reason.trim(), days });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Overlay>
      <div className="backdrop" onMouseDown={(event) => event.target === event.currentTarget && !busy && onClose()}>
        <div className="modal glass" role="dialog" aria-modal="true">
          <div className="modal-icon" style={{ background: GRADIENTS[tone] }}>
            <FontAwesomeIcon icon={icon} />
          </div>
          <h3>{title}</h3>
          <p className="modal-message">{message}</p>

          {askDays ? (
            <div className="field">
              <span>Suspend for</span>
              <div className="chips">
                {DAY_CHOICES.map((choice) => (
                  <button
                    key={choice}
                    type="button"
                    className={`chip${choice === days ? ' active' : ''}`}
                    onClick={() => setDays(choice)}
                  >
                    {choice} day{choice === 1 ? '' : 's'}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {askReason ? (
            <label className="field">
              <span>Reason{reasonRequired ? '' : ' (optional)'} — they will see this</span>
              <textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                maxLength={300}
                placeholder="e.g. Reported for misbehaviour"
              />
            </label>
          ) : null}

          <div className="actions">
            <button className="btn btn-ghost" onClick={onClose} disabled={busy}>
              Go back
            </button>
            <button className={`btn ${BUTTONS[tone]}`} onClick={submit} disabled={busy || (reasonRequired && !reason.trim())}>
              {busy ? <Spinner small /> : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </Overlay>
  );
}
