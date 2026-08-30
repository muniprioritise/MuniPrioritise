import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { loginSupervisor } from '../services/dashboardApi.js';

function LoginPage() {
  const { isAuthenticated, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: 'supervisor@example.com', password: 'password123' });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  if (isAuthenticated) {
    return <Navigate to="/overview" replace />;
  }

  const redirectTo = location.state?.from || '/overview';

  const handleChange = (event) => {
    setForm((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      const auth = await loginSupervisor(form);
      login({ token: auth.token, user: auth.user });
      navigate(redirectTo, { replace: true });
    } catch (requestError) {
      setError(requestError.message || 'Unable to sign in.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="login-page">
      <section className="login-card" aria-labelledby="supervisor-login-heading">
        <p className="login-kicker">MuniPrioritise</p>
        <h1 id="supervisor-login-heading" className="login-title">Supervisor Dashboard Login</h1>
        <p className="login-description">
          Sign in to review municipal requests, adjust queue priorities, and export governance reports.
        </p>

        <form onSubmit={handleSubmit} className="login-form">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            name="email"
            type="email"
            required
            value={form.email}
            onChange={handleChange}
            autoComplete="email"
          />

          <label htmlFor="password">Password</label>
          <input
            id="password"
            name="password"
            type="password"
            required
            value={form.password}
            onChange={handleChange}
            autoComplete="current-password"
          />

          {error && <p className="form-error">{error}</p>}

          <button type="submit" className="primary-btn" disabled={isLoading}>
            {isLoading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
      </section>
    </main>
  );
}

export default LoginPage;
