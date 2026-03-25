import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loginFranchiseAdmin } from '../services/api.js';

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      await loginFranchiseAdmin({ email: email.trim(), password });
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message || 'Login gagal');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-shell">
      <div className="bg-glow bg-glow-a" />
      <div className="bg-glow bg-glow-b" />

      <form className="login-card" onSubmit={handleSubmit}>
        <p className="eyebrow">PRIMARY LINE INDONESIA</p>
        <h1>Franchise Admin Login</h1>
        <p className="subtext">Masuk menggunakan email admin franchise yang sudah diaktifkan.</p>

        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="admin@franchise.com"
          required
        />

        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="••••••••"
          required
          minLength={6}
        />

        {error ? <p className="text-danger">{error}</p> : null}

        <button type="submit" className="solid-btn" disabled={loading}>
          {loading ? 'Memproses...' : 'Masuk'}
        </button>
      </form>
    </div>
  );
}

export default LoginPage;
