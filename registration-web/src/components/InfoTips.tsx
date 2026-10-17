import { useState } from 'react';
import { createPortal } from 'react-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCircleInfo, faLightbulb } from '@fortawesome/free-solid-svg-icons';

interface InfoTipsProps {
  title: string;
  tips: string[];
}

/** The "Info" pill at the top right of a form (same as the apps): the form's explanations live in the card it opens. */
export function InfoTips({ title, tips }: InfoTipsProps) {
  const [open, setOpen] = useState(false);
  return (
    <div className="info-tips">
      <button type="button" className="info-tips__pill" onClick={() => setOpen(true)}>
        <FontAwesomeIcon icon={faCircleInfo} /> Info
      </button>
      {open
        ? createPortal(
            <div className="info-tips__backdrop" onClick={() => setOpen(false)}>
              <div className="info-tips__card" onClick={(event) => event.stopPropagation()}>
                <div className="info-tips__head">
                  <span className="info-tips__icon">
                    <FontAwesomeIcon icon={faLightbulb} />
                  </span>
                  <strong>{title}</strong>
                </div>
                <ul>
                  {tips.map((tip) => (
                    <li key={tip}>{tip}</li>
                  ))}
                </ul>
                <button type="button" className="button" onClick={() => setOpen(false)}>
                  Got it
                </button>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
