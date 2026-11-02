import { Link, useNavigate } from 'react-router-dom';
import { demoReset } from '../lib/demoApi';
import { session } from '../lib/session';

/** Shown only in the shareable demo build. */
export function DemoBar() {
  const nav = useNavigate();
  return (
    <div className="demobar" role="note">
      <span><b>Demo.</b> Example data, saved only in this browser.</span>
      <span className="demobar__links">
        <Link to="/">Patient app</Link>
        <Link to="/provider/DEMO42">Provider view</Link>
        <button type="button" onClick={() => { demoReset(); session.clear(); nav('/', { replace: true }); }}>Reset</button>
      </span>
    </div>
  );
}
