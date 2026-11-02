import { Navigate, Route, Routes } from 'react-router-dom';
import { session } from './lib/session';
import { Welcome } from './pages/patient/Welcome';
import { Intake } from './pages/patient/Intake';
import { Home } from './pages/patient/Home';
import { CheckFlow } from './pages/patient/CheckFlow';
import { Result } from './pages/patient/Result';
import { ProviderLogin } from './pages/provider/ProviderLogin';
import { ProviderList } from './pages/provider/ProviderList';
import { ProviderPatient } from './pages/provider/ProviderPatient';

export function App() {
  return (
    <Routes>
      <Route path="/" element={session.get() ? <Home /> : <Welcome />} />
      <Route path="/setup" element={<Intake />} />
      <Route path="/check" element={session.get() ? <CheckFlow /> : <Navigate to="/" replace />} />
      <Route path="/result/:checkId" element={<Result />} />
      <Route path="/provider" element={<ProviderLogin />} />
      <Route path="/provider/:code" element={<ProviderList />} />
      <Route path="/provider/:code/patients/:id" element={<ProviderPatient />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
