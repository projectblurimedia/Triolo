import { Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronLeft } from '@fortawesome/free-solid-svg-icons';

interface PageHeaderProps {
  title: string;
  backTo?: string;
  shop?: boolean;
}

/** Website-only header — no subtitle, kept short; a back button (when given) sits beside the title, not above it. Mobile apps' GradientHeader is unaffected — see .cloud/architecture.md. */
export function PageHeader({ title, backTo, shop }: PageHeaderProps) {
  return (
    <div className={`header ${shop ? 'header--shop' : ''}`}>
      <div className="header__row">
        {backTo ? (
          <Link to={backTo} className="header__back" aria-label="Back">
            <FontAwesomeIcon icon={faChevronLeft} />
          </Link>
        ) : null}
        <p className="header__title">{title}</p>
      </div>
    </div>
  );
}
