import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBolt, faTableCellsLarge } from '@fortawesome/free-solid-svg-icons';

/*
 * (Copied between admin-web and ads-web — keep in sync.)
 * Where an ad shows: full screen before key actions, or as a wide card in the slider at the
 * top of the apps' Home (horizontal pictures and videos only).
 */
export type AdShowOn = 'action' | 'home';

const OPTIONS: { value: AdShowOn; icon: typeof faBolt; title: string; text: string }[] = [
  {
    value: 'home',
    icon: faTableCellsLarge,
    title: 'Home slider',
    text: 'A wide card at the top of Home that slides by itself. Videos play on their own. Wide (16:9) picture or video.',
  },
  {
    value: 'action',
    icon: faBolt,
    title: 'Before actions',
    text: 'Full screen for a few seconds when people book, order or call. Tall or wide.',
  },
];

export function AdShowOnPicker({ value, onChange, disabled }: { value: AdShowOn; onChange: (value: AdShowOn) => void; disabled?: boolean }) {
  return (
    <div className="show-on">
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          className={`show-on-card${value === option.value ? ' active' : ''}`}
          disabled={disabled}
          onClick={() => onChange(option.value)}
        >
          <span className="show-on-icon">
            <FontAwesomeIcon icon={option.icon} />
          </span>
          <strong>{option.title}</strong>
          <span>{option.text}</span>
        </button>
      ))}
    </div>
  );
}

export function showOnLabel(value: AdShowOn | undefined): string {
  return value === 'home' ? 'Home slider' : 'Before actions';
}
