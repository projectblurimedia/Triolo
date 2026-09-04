interface VerificationBadgeProps {
  status: string;
}

const CONFIG: Record<string, { className: string; label: string }> = {
  verified: { className: 'badge--verified', label: 'Verified' },
  rejected: { className: 'badge--rejected', label: 'Rejected' },
  pending_verification: { className: 'badge--pending', label: 'Pending Review' },
};

export function VerificationBadge({ status }: VerificationBadgeProps) {
  const config = CONFIG[status] ?? CONFIG.pending_verification;
  return <span className={`badge ${config.className}`}>{config.label}</span>;
}
