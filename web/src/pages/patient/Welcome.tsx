import { Link } from 'react-router-dom';
import { Screen } from '../../components/Screen';

export function Welcome() {
  return (
    <Screen footer={<><Link to="/setup" className="rise-btn rise-btn--primary rise-btn--block">Set up my first check</Link>
      <Link to="/provider" className="rise-btn rise-btn--quiet">I'm a care provider</Link></>}>
      <svg className="hero-mark" viewBox="0 0 360 200" aria-hidden="true">
        <rect className="slab" x="64" y="0" width="296" height="200" rx="24" />
        <rect className="tint" x="0" y="120" width="96" height="80" rx="12" />
        <path className="arc" d="M64 136 A64 64 0 0 1 128 200" /><path className="arc" d="M64 72 A128 128 0 0 1 192 200" /><path className="arc" d="M64 8 A192 192 0 0 1 256 200" />
        <circle className="dot" cx="300" cy="56" r="28" />
      </svg>
      <h1 className="display-xl">Are you losing fat, or muscle?</h1>
      <p className="rise-body-lg">Rise is a 3-minute muscle check on your phone for people taking GLP-1 medications. You stand up from a chair for 30 seconds, and we tell you whether your plan is protecting your muscle.</p>
      <ul className="stack" style={{ margin: 0, paddingLeft: 24 }}>
        <li>Your care team sees your results, so they know when to check in.</li>
        <li>Your video stays on your phone. Only the count is saved.</li>
        <li>Rise tracks change over time. It doesn't diagnose.</li>
      </ul>
    </Screen>
  );
}
