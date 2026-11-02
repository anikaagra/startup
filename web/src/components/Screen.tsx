import { Link } from 'react-router-dom';

export function Screen({ children, footer, wide = false, back }: { children: React.ReactNode; footer?: React.ReactNode; wide?: boolean; back?: { to: string; label: string } }) {
  return (
    <div className={`screen${wide ? ' screen--wide' : ''}`}>
      <header className="topbar">
        <Link to="/" className="brand" aria-label="Rise home">
          <svg viewBox="0 0 32 32" aria-hidden="true" width="28" height="28"><rect width="32" height="32" rx="8" className="brand__tile" /><path d="M8 25 A6 6 0 0 1 14 19 M8 25 A11 11 0 0 1 19 14 M8 25 A16 16 0 0 1 24 9" className="brand__arc" /></svg>
          <span>Rise</span>
        </Link>
        {back && <Link to={back.to} className="rise-btn rise-btn--quiet">{back.label}</Link>}
      </header>
      <main className="screen__body">{children}</main>
      {footer && <div className="screen__footer">{footer}</div>}
    </div>
  );
}

export function ErrorNote({ message }: { message: string | null }) {
  if (!message) return null;
  return <p role="alert" className="error-note">{message}</p>;
}
