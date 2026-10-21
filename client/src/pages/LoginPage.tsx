import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { Alert } from '../components/ui';

const DEMO = [
  { role: 'Student', email: 'esther@uni.edu', password: 'student123', note: 'Esther Burns · at her 3-item limit' },
  { role: 'Student', email: 'uriel@uni.edu', password: 'student123', note: 'Uriel Smith · one item on loan' },
  { role: 'Faculty', email: 'aliza@uni.edu', password: 'faculty123', note: 'Aliza Salman · has an overdue item' },
  { role: 'Employee', email: 'clark@library.edu', password: 'staff123', note: 'Clark Nguyen · circulation + reports' },
  { role: 'Admin', email: 'azael@library.edu', password: 'admin123', note: 'Azael Aaron · everything + staff records' },
];

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
    <div className="login-page">
      <div className="login-card">
        <img className="login-mascot" src="/mascot.png" alt="Uma's Library cougar mascot" />
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
        <p className="auth-switch">New to Uma’s Library? <Link to="/signup">Create an account</Link></p>
        <div className="demo">
          <h3>Demo accounts</h3>
          <p className="muted">Click one to fill the form. Remove this block before a real deployment.</p>
          {DEMO.map((d) => (
            <button key={d.email} type="button" className="demo-row" onClick={() => { setEmail(d.email); setPassword(d.password); }}>
              <strong>{d.role}</strong> <span>{d.email}</span> <em>{d.note}</em>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
