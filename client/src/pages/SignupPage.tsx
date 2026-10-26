import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { Alert } from '../components/ui';
import { MascotCloud, Sky } from '../components/Sky';

export default function SignupPage() {
  const { signup } = useAuth();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'student' | 'faculty'>('student');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setBusy(true);
    try {

      await signup({ first_name: firstName, last_name: lastName, email, password, role });
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <div className="login-page">
      <Sky />
      <div className="login-wrap">
      <MascotCloud />
      <div className="login-card">
        <h1>Create an account</h1>
        <p className="muted">Sign up to borrow books, place holds and book study rooms.</p>
        <form onSubmit={submit} className="form">
          <label><span>First name</span>
            <input value={firstName} onChange={(e) => setFirstName(e.target.value)} required autoFocus />
          </label>
          <label><span>Last name</span>
            <input value={lastName} onChange={(e) => setLastName(e.target.value)} required />
          </label>
          <label><span>Email</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          <label><span>I am a</span>
            <select value={role} onChange={(e) => setRole(e.target.value as 'student' | 'faculty')}>
              <option value="student">Student</option>
              <option value="faculty">Faculty</option>
            </select>
          </label>
          <label><span>Password</span>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
            <small className="muted">At least 6 characters.</small>
          </label>
          <label><span>Confirm password</span>
            <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={6} />
          </label>
          {error && <Alert kind="error">{error}</Alert>}
          <button className="btn primary" disabled={busy}>{busy ? 'Creating account…' : 'Create account'}</button>
        </form>
        <p className="auth-switch">Already have an account? <Link to="/login">Sign in</Link></p>
      </div>
      </div>
    </div>
  );
}
