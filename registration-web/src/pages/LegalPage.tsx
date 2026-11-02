import { useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/PageHeader';
import { Lang, LegalDoc } from '@/legal/content';

function savedLang(): Lang {
  try {
    return localStorage.getItem('triolo-legal-lang') === 'te' ? 'te' : 'en';
  } catch {
    return 'en';
  }
}

/** One legal page (Privacy, Terms, Refunds) in English or Telugu, with links to the others. */
export function LegalPage({ doc }: { doc: Record<Lang, LegalDoc> }) {
  const [lang, setLang] = useState<Lang>(savedLang);
  const content = doc[lang];
  const choose = (next: Lang) => {
    setLang(next);
    try {
      localStorage.setItem('triolo-legal-lang', next);
    } catch {
      // A preference only.
    }
  };

  return (
    <div className="page">
      <PageHeader title={content.title} subtitle={content.subtitle} backTo="/" />
      <div className="body legal">
        <div className="legal__lang">
          <button type="button" className={lang === 'en' ? 'chip chip--active' : 'chip'} onClick={() => choose('en')}>
            English
          </button>
          <button type="button" className={lang === 'te' ? 'chip chip--active' : 'chip'} onClick={() => choose('te')}>
            తెలుగు
          </button>
        </div>
        <p className="legal__intro">{content.intro}</p>
        {content.sections.map((section) => (
          <section key={section.heading} className="legal__section">
            <h2>{section.heading}</h2>
            {section.body.map((line) =>
              line.startsWith('• ') ? (
                <p key={line} className="legal__bullet">
                  {line.slice(2)}
                </p>
              ) : (
                <p key={line}>{line}</p>
              ),
            )}
          </section>
        ))}
        <LegalLinks />
      </div>
    </div>
  );
}

/** The four legal links, at the bottom of every page. */
export function LegalLinks() {
  return (
    <nav className="legal__links">
      <Link to="/privacy">Privacy Policy</Link>
      <Link to="/terms">Terms of Use</Link>
      <Link to="/refunds">Refund Policy</Link>
      <Link to="/delete-account">Delete account</Link>
    </nav>
  );
}
