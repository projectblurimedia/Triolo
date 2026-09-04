import { Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronLeft, faShapes } from '@fortawesome/free-solid-svg-icons';

interface PageHeaderProps {
  title: string;
  backTo?: string;
}

/** Website-only header — no subtitle, kept short; a back button (when given) sits beside the title in a rounded circular button (matching the mobile apps' GradientHeader iconButton), and a brand mark (the same `shapes` glyph the mobile apps use everywhere as their generic Triolo mark) sits beside the title too. Always the brand-blue gradient — Business registration is visually identical to Worker registration, no separate "shop" styling anywhere on this site. Mobile apps' GradientHeader is unaffected — see .cloud/architecture.md. */
export function PageHeader({ title, backTo }: PageHeaderProps) {
  return (
    <div className="header">
      <div className="header__row">
        {backTo ? (
          <Link to={backTo} className="header__iconButton" aria-label="Back">
            <FontAwesomeIcon icon={faChevronLeft} />
          </Link>
        ) : null}
        <span className="header__iconButton header__logo" aria-hidden="true">
          <FontAwesomeIcon icon={faShapes} />
        </span>
        <p className="header__title">{title}</p>
      </div>
    </div>
  );
}
