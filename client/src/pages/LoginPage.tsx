import { FormEvent, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { Alert } from '../components/ui';
import { MascotCloud } from '../components/Sky';

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await login(email, password);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <div className="login-page snoopy-bg">
      <div className="login-wrap">
      <MascotCloud />
      <div className="login-card">
        <h1>Uma’s Library</h1>
        <p className="muted">Sign in with your library account.</p>
        <form onSubmit={submit} className="form">
          <label><span>Email</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
          </label>
          <label><span>Password</span>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </label>
          {error && <Alert kind="error">{error}</Alert>}
          <button className="btn primary" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
        </form>
        <p className="auth-switch">Need an account? Ask a library admin.</p>
      </div>
      </div>
    </div>
  );
}
