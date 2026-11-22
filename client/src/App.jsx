import { useState, useEffect, useCallback } from 'react';
import { api } from './api';
import './App.css';

const money = (cents) =>
  new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(cents / 100);
const when = (iso) => new Date(iso).toLocaleString();

function loadSession() {
  try { return JSON.parse(localStorage.getItem('session')); } catch { return null; }
}

export default function App() {
  const [session, setSession] = useState(loadSession);
  const [view, setView] = useState('events');
  const token = session?.token;
  const user = session?.user;

  function saveSession(s) {
    setSession(s);
    try {
      if (s) localStorage.setItem('session', JSON.stringify(s));
      else localStorage.removeItem('session');
    } catch { /* storage unavailable */ }
  }

  return (
    <div className="app">
      <header>
        <h1>Ticketly</h1>
        <nav>
          <button onClick={() => setView('events')}>Events</button>
          {user && <button onClick={() => setView('bookings')}>My bookings</button>}
          {user?.role === 'admin' && <button onClick={() => setView('admin')}>Admin</button>}
          {user ? (
            <button onClick={() => { saveSession(null); setView('events'); }}>Log out ({user.email})</button>
          ) : (
            <button className="primary" onClick={() => setView('login')}>Log in</button>
          )}
        </nav>
      </header>
      <main>
        {view === 'login' && !user && (
          <AuthForm onDone={(s) => { saveSession(s); setView('events'); }} />
        )}
        {view === 'events' && <Events token={token} onNeedLogin={() => setView('login')} />}
        {view === 'bookings' && user && <Bookings token={token} />}
        {view === 'admin' && user?.role === 'admin' && <Admin token={token} />}
      </main>
    </div>
  );
}

function AuthForm({ onDone }) {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault();
    setError('');
    try {
      if (mode === 'register') await api('/auth/register', { method: 'POST', body: { email, password } });
      const data = await api('/auth/login', { method: 'POST', body: { email, password } });
      onDone({ token: data.token, user: data.user });
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <form className="card" onSubmit={submit}>
      <h3>{mode === 'login' ? 'Log in' : 'Create an account'}</h3>
      <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      <input type="password" placeholder="Password (10+ characters)" value={password}
        onChange={(e) => setPassword(e.target.value)} required />
      {error && <p className="error">{error}</p>}
      <div className="row">
        <button className="primary" type="submit">{mode === 'login' ? 'Log in' : 'Register'}</button>
        <button type="button" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
          {mode === 'login' ? 'Need an account?' : 'Have an account?'}
        </button>
      </div>
    </form>
  );
}

function Events({ token, onNeedLogin }) {
  const [events, setEvents] = useState([]);
  const [qty, setQty] = useState({});
  const [msg, setMsg] = useState('');

  useEffect(() => {
    api('/events').then(setEvents).catch((e) => setMsg(e.message));
  }, []);

  async function book(id) {
    if (!token) return onNeedLogin();
    try {
      await api('/bookings', { method: 'POST', token, body: { event_id: id, quantity: Number(qty[id] || 1) } });
      setMsg('Booked! See it under My bookings.');
    } catch (e) {
      setMsg(e.message);
    }
  }

  return (
    <>
      {msg && <div className="msg">{msg}</div>}
      {events.length === 0 && <p className="muted">No events yet.</p>}
      {events.map((ev) => (
        <div className="card" key={ev.id}>
          <h3>{ev.title}</h3>
          <div className="muted">{ev.venue} · {when(ev.starts_at)} · {money(ev.price_cents)}</div>
          {ev.description && <p>{ev.description}</p>}
          <div className="row">
            <input className="small" type="number" min="1" max="10" value={qty[ev.id] || 1}
              onChange={(e) => setQty({ ...qty, [ev.id]: e.target.value })} />
            <button className="primary" onClick={() => book(ev.id)}>Book tickets</button>
          </div>
        </div>
      ))}
    </>
  );
}

function Bookings({ token }) {
  const [items, setItems] = useState([]);
  const [msg, setMsg] = useState('');

  const load = useCallback(() => {
    api('/bookings', { token }).then(setItems).catch((e) => setMsg(e.message));
  }, [token]);
  useEffect(load, [load]);

  async function cancel(id) {
    try { await api(`/bookings/${id}`, { method: 'DELETE', token }); load(); }
    catch (e) { setMsg(e.message); }
  }

  return (
    <>
      {msg && <div className="msg">{msg}</div>}
      {items.length === 0 && <p className="muted">You have no bookings.</p>}
      {items.map((b) => (
        <div className="card" key={b.id}>
          <h3>{b.title}</h3>
          <div className="muted">{b.venue} · {when(b.starts_at)} · {b.quantity} ticket(s)</div>
          <div className="row"><button className="danger" onClick={() => cancel(b.id)}>Cancel booking</button></div>
        </div>
      ))}
    </>
  );
}

function Admin({ token }) {
  const [events, setEvents] = useState([]);
  const [form, setForm] = useState({ title: '', venue: '', starts_at: '', price: '', capacity: '' });
  const [msg, setMsg] = useState('');

  const load = useCallback(() => { api('/events').then(setEvents).catch((e) => setMsg(e.message)); }, []);
  useEffect(load, [load]);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function create(e) {
    e.preventDefault();
    setMsg('');
    try {
      await api('/events', {
        method: 'POST', token,
        body: {
          title: form.title,
          venue: form.venue,
          starts_at: new Date(form.starts_at).toISOString(),
          price_cents: Math.round(Number(form.price) * 100),
          capacity: Number(form.capacity),
        },
      });
      setForm({ title: '', venue: '', starts_at: '', price: '', capacity: '' });
      load();
    } catch (err) {
      setMsg(err.message);
    }
  }

  async function remove(id) {
    try { await api(`/events/${id}`, { method: 'DELETE', token }); load(); }
    catch (e) { setMsg(e.message); }
  }

  return (
    <>
      <form className="card" onSubmit={create}>
        <h3>Create event</h3>
        <input placeholder="Title" value={form.title} onChange={set('title')} required />
        <input placeholder="Venue" value={form.venue} onChange={set('venue')} required />
        <input type="datetime-local" value={form.starts_at} onChange={set('starts_at')} required />
        <input type="number" step="0.01" min="0" placeholder="Price" value={form.price} onChange={set('price')} required />
        <input type="number" min="1" placeholder="Capacity" value={form.capacity} onChange={set('capacity')} required />
        {msg && <p className="error">{msg}</p>}
        <div className="row"><button className="primary" type="submit">Create</button></div>
      </form>
      {events.map((ev) => (
        <div className="card" key={ev.id}>
          <h3>{ev.title}</h3>
          <div className="muted">{ev.venue} · {when(ev.starts_at)} · capacity {ev.capacity}</div>
          <div className="row"><button className="danger" onClick={() => remove(ev.id)}>Delete event</button></div>
        </div>
      ))}
    </>
  );
}