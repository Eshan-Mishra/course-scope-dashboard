'use client';

import type { AuthenticatedUser, DashboardData } from '@course-scope/contracts';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { RevenueBarChart } from './components/revenue-bar-chart';
import { api } from './lib/api';

const money = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
const demoUsers = [
  ['Admin', 'admin@coursescope.test'],
  ['North Manager', 'north@coursescope.test'],
  ['South Manager', 'south@coursescope.test'],
] as const;

export default function Home() {
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [region, setRegion] = useState('ALL');
  const [email, setEmail] = useState<string>(demoUsers[0][1]);
  const [password, setPassword] = useState('Demo@123');
  const [mfaCode, setMfaCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api<{ user: AuthenticatedUser }>('/auth/me')
      .then(({ user: currentUser }) => setUser(currentUser))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!user) return;
    setError('');
    api<DashboardData>(`/analytics/dashboard?region=${encodeURIComponent(region)}`)
      .then(setDashboard)
      .catch((requestError: Error) => setError(requestError.message));
  }, [user, region]);

  const opportunity = useMemo(
    () => dashboard?.categoryHealth.reduce((lowest, item) => (item.completionRate < lowest.completionRate ? item : lowest)),
    [dashboard],
  );

  async function login(event: FormEvent) {
    event.preventDefault();
    setError('');
    try {
      const result = await api<{ user: AuthenticatedUser }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password, ...(mfaCode ? { mfaCode } : {}) }),
      });
      setRegion(result.user.region ?? 'ALL');
      setUser(result.user);
    } catch (requestError) {
      setError((requestError as Error).message);
    }
  }

  async function logout() {
    await api('/auth/logout', { method: 'POST' });
    setUser(null);
    setDashboard(null);
    setRegion('ALL');
  }

  if (loading) return <main className="centered">Loading CourseScope…</main>;

  if (!user) {
    return (
      <main className="login-shell">
        <section className="login-copy">
          <div className="brand-mark">CS</div>
          <span className="eyebrow">Learning intelligence</span>
          <h1>See the signal.<br />Keep the scope.</h1>
          <p>CourseScope turns enrollment data into decisions while keeping every manager inside their authorized region.</p>
          <div className="trust-line"><span>Server enforced</span><span>Role aware</span><span>Audit ready</span></div>
        </section>
        <section className="login-card" aria-labelledby="login-title">
          <div>
            <span className="eyebrow">Secure access</span>
            <h2 id="login-title">Welcome back</h2>
            <p>Choose a demo role or enter the documented credentials.</p>
          </div>
          <div className="role-switcher" aria-label="Demo roles">
            {demoUsers.map(([label, value]) => (
              <button className={email === value ? 'active' : ''} type="button" key={value} onClick={() => setEmail(value)}>{label}</button>
            ))}
          </div>
          <form onSubmit={login}>
            <label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
            <label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} required /></label>
            <label>MFA code (if enabled)<input inputMode="numeric" autoComplete="one-time-code" value={mfaCode} onChange={(event) => setMfaCode(event.target.value.replace(/\D/g, '').slice(0, 6))} pattern="\d{6}" /></label>
            {error && <p className="error" role="alert">{error}</p>}
            <button className="primary" type="submit">Open dashboard <span>→</span></button>
          </form>
        </section>
      </main>
    );
  }

  return (
    <main className="dashboard-shell">
      <header className="topbar">
        <div className="brand"><span className="brand-mark small">CS</span><span>CourseScope</span></div>
        <div className="session">
          <span><strong>{user.role === 'admin' ? 'Administrator' : `${user.region} Manager`}</strong><small>{user.email}</small></span>
          <button type="button" onClick={logout}>Sign out</button>
        </div>
      </header>

      <section className="dashboard-heading">
        <div><span className="eyebrow">Managerial dashboard</span><h1>Learning portfolio</h1><p>Revenue and learner health for the data you are authorized to see.</p></div>
        <label className="scope-control">Region scope
          <select value={region} onChange={(event) => setRegion(event.target.value)}>
            {user.role === 'admin' && <option value="ALL">All regions</option>}
            {(dashboard?.availableRegions ?? (user.region ? [user.region] : [])).map((option) => <option key={option}>{option}</option>)}
          </select>
        </label>
      </section>

      {error && <p className="error banner" role="alert">{error}</p>}
      {!dashboard ? <p>Loading analytics…</p> : (
        <>
          <section className="metric-grid" aria-label="Portfolio summary">
            <article><span>Total revenue</span><strong>{money.format(dashboard.summary.revenue)}</strong><small>{dashboard.scope === 'ALL' ? 'All regions' : dashboard.scope}</small></article>
            <article><span>Active learners</span><strong>{dashboard.summary.learners}</strong><small>{dashboard.summary.enrollments} enrollments</small></article>
            <article><span>Completion rate</span><strong>{dashboard.summary.completionRate}%</strong><small>Completed enrollments</small></article>
            <article><span>Average rating</span><strong>{dashboard.summary.averageRating.toFixed(1)}</strong><small>Out of 5</small></article>
          </section>

          <RevenueBarChart data={dashboard.revenueByCategory} />

          <section className="insight-grid">
            <article className="panel insight-copy">
              <span className="eyebrow">Decision signal</span>
              <h2>Where attention is needed</h2>
              {opportunity && <><p><strong>{opportunity.category}</strong> has the lowest completion rate in this scope at <strong>{opportunity.completionRate}%</strong>.</p><p>Its average learner rating is {opportunity.averageRating.toFixed(1)}/5 with a {opportunity.dropRate}% drop rate. Review course design and learner support before focusing only on revenue.</p></>}
            </article>
            <article className="panel health-table">
              <div><span className="eyebrow">Open-ended insight</span><h2>Category health</h2></div>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Category</th><th>Enrollments</th><th>Completion</th><th>Drop rate</th><th>Rating</th></tr></thead>
                  <tbody>{dashboard.categoryHealth.map((item) => <tr key={item.category}><th>{item.category}</th><td>{item.enrollments}</td><td>{item.completionRate}%</td><td>{item.dropRate}%</td><td>{item.averageRating.toFixed(1)}</td></tr>)}</tbody>
                </table>
              </div>
            </article>
          </section>
        </>
      )}
    </main>
  );
}
