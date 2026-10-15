import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBan, faClock, faRotateLeft, faTrash } from '@fortawesome/free-solid-svg-icons';
import { adminApi, Account } from '@/services/adminApi';
import { showToast } from '@/state/toastStore';
import { getErrorMessage } from '@/services/errorMessages';
import { formatDate } from '@/utils/format';
import { useLayout } from './Layout';
import { ConfirmModal } from './ConfirmModal';

type Action = 'suspend' | 'ban' | 'reactivate' | 'remove';

/**
 * Suspend for some days, ban, reactivate, or delete (removes their worker / shop / job post
 * profiles and bans the account — past bookings and orders are kept). Each asks first, and
 * the person is told what happened and why.
 */
export function AccountActions({
  account,
  onDone,
}: {
  account: Pick<Account, 'id' | 'fullName' | 'status' | 'role' | 'suspendedUntil'>;
  onDone: () => void;
}) {
  const [action, setAction] = useState<Action | null>(null);
  const { refreshStats } = useLayout();

  if (account.role === 'admin') {
    return <p className="muted">Admin accounts can&apos;t be suspended or removed here.</p>;
  }

  const run = async (reason: string, days: number) => {
    try {
      if (action === 'remove') {
        await adminApi.removeProfiles(account.id, reason || undefined);
        showToast({
          variant: 'success',
          title: 'Profiles removed',
          message: `${account.fullName} is banned and their profiles are gone.`,
        });
      } else if (action) {
        await adminApi.moderate(account.id, {
          action,
          days: action === 'suspend' ? days : undefined,
          reason: reason || undefined,
        });
        showToast({
          variant: 'success',
          title:
            action === 'suspend'
              ? `Suspended for ${days} day${days === 1 ? '' : 's'}`
              : action === 'ban'
                ? 'Account banned'
                : 'Account active again',
          message:
            action === 'reactivate'
              ? `${account.fullName} can use Triolo again.`
              : `${account.fullName} has been signed out and told why.`,
        });
      }
      setAction(null);
      refreshStats();
      onDone();
    } catch (err) {
      showToast({ variant: 'error', title: 'Could not do that', message: getErrorMessage(err) });
    }
  };

  const blocked = account.status === 'blocked';
  const suspended = account.status === 'suspended';

  return (
    <>
      <div className="actions">
        {blocked || suspended ? (
          <button className="btn btn-success" onClick={() => setAction('reactivate')}>
            <FontAwesomeIcon icon={faRotateLeft} /> Reactivate
          </button>
        ) : (
          <button className="btn btn-warning" onClick={() => setAction('suspend')}>
            <FontAwesomeIcon icon={faClock} /> Suspend
          </button>
        )}
        {!blocked ? (
          <button className="btn btn-danger" onClick={() => setAction('ban')}>
            <span className="btn-badge">
              <FontAwesomeIcon icon={faBan} />
            </span>
            Ban permanently
          </button>
        ) : null}
        <button className="btn btn-danger" onClick={() => setAction('remove')}>
          <span className="btn-badge">
            <FontAwesomeIcon icon={faTrash} />
          </span>
          Delete profiles
        </button>
      </div>
      {suspended && account.suspendedUntil ? (
        <p className="muted" style={{ marginTop: 10 }}>
          Suspended until {formatDate(account.suspendedUntil)}.
        </p>
      ) : null}

      <ConfirmModal
        open={action === 'suspend'}
        icon={faClock}
        tone="warning"
        title={`Suspend ${account.fullName}?`}
        message="They are signed out at once and can't log in until the suspension ends. Their bookings and orders in progress are cancelled and the other side is told."
        confirmLabel="Suspend"
        askDays
        askReason
        onConfirm={({ reason, days }) => run(reason, days)}
        onClose={() => setAction(null)}
      />
      <ConfirmModal
        open={action === 'ban'}
        icon={faBan}
        tone="danger"
        title={`Ban ${account.fullName}?`}
        message="They are signed out and can never log in again (unless you reactivate them). Bookings and orders in progress are cancelled."
        confirmLabel="Ban permanently"
        askReason
        onConfirm={({ reason, days }) => run(reason, days)}
        onClose={() => setAction(null)}
      />
      <ConfirmModal
        open={action === 'reactivate'}
        icon={faRotateLeft}
        tone="success"
        title={`Reactivate ${account.fullName}?`}
        message="They can log in and use Triolo again straight away."
        confirmLabel="Reactivate"
        onConfirm={({ reason, days }) => run(reason, days)}
        onClose={() => setAction(null)}
      />
      <ConfirmModal
        open={action === 'remove'}
        icon={faTrash}
        tone="danger"
        title={`Delete ${account.fullName}'s profiles?`}
        message="Removes their worker, shop and job post profiles with all photos, and bans the account. Past bookings and orders stay for everyone's history. This can't be undone."
        confirmLabel="Delete & ban"
        askReason
        onConfirm={({ reason, days }) => run(reason, days)}
        onClose={() => setAction(null)}
      />
    </>
  );
}
