import { Navigate, useLocation } from 'react-router-dom';

// Invitations and ordinary registration use the same resumable wizard.
export default function Register() {
  const { search } = useLocation();
  return <Navigate to={`/onboarding${search}`} replace />;
}
