import { useState, useEffect, useCallback } from 'react';
import { api } from './api';
import './App.css';

const CATS = ['Music', 'Comedy', 'Theatre', 'Sports', 'Conferences'];
const money = (c) =>
  c === 0 ? 'Free' : new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(c / 100);
const fmt = (iso) =>
  new Date(iso).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

function loadSession() {
  try { return JSON.parse(localStorage.getItem('session')); } catch { return null; }
}

function Poster({ id, date }) {
  const d = new Date(date);
  return (
    <div className={`poster p${id % 5}`} aria-hidden="true">
      <span className="mo">{d.toLocaleString(undefined, { month: 'short' })}</span>
      <span className="dy">{d.getDate()}</span>
    </div>
  );
}

function Toast({ text, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 4500);
    return () => clearTimeout(t);
  }, [text, onClose]);
  return <div className="toast" role="status">{text}</div>;
}

export default function App() {
  const [session, setSession] = useState(loadSession);
  const [view, setView] = useState('home');
  const [filter, setFilter] = useState({ q: '', cat: 'All' });
  const [events, setEvents] = useState(null);
  const [toast, setToast] = useState('');
  const [menu, setMenu] = useState(false);
  const token = session?.token;
  const user = session?.user;
  const closeToast = useCallback(() => setToast(''), []);

  const loadEvents = useCallback(() => {
    api('/events').then(setEvents).catch((e) => { setEvents([]); setToast(e.message); });
  }, []);
  useEffect(loadEvents, [loadEvents]);

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(false);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [menu]);

  function go(v, f) {
    setView(v);
    if (f) setFilter({ q: '', cat: 'All', ...f });
    setMenu(false);
    window.scrollTo(0, 0);
  }

  function saveSession(s) {
    setSession(s);
    try {
      if (s) localStorage.setItem('session', JSON.stringify(s));
      else localStorage.removeItem('session');
    } catch { /* storage unavailable */ }
  }

  const tab = (v, label) => (
    <button className="nl" aria-current={view === v ? 'page' : undefined} onClick={() => go(v, v === 'events' ? {} : undefined)}>{label}</button>
  );

  return (
    <>
      <header className="top">
        <div className="wrap">
          <button className="brand" onClick={() => go('home')}>
            <span className="logo" aria-hidden="true">T</span>Ticketly
          </button>
          <nav aria-label="Main">
            {tab('home', 'Home')}
            {tab('events', 'Events')}
            {user ? (
              <div className="acct">
                <button className="avatar" aria-label="Account menu" aria-expanded={menu}
                  onClick={(e) => { e.stopPropagation(); setMenu(!menu); }}>
                  {user.email[0].toUpperCase()}
                </button>
                {menu && (
                  <div className="dd">
                    <div className="em">{user.email}</div>
                    <button onClick={() => go('tickets')}>My tickets</button>
                    {user.role === 'admin' && <button onClick={() => go('admin')}>Manage events</button>}
                    <button onClick={() => { saveSession(null); go('home'); }}>Log out</button>
                  </div>
                )}
              </div>
            ) : (
              <button className="btn primary" onClick={() => go('login')}>Log in</button>
            )}
          </nav>
        </div>
      </header>
      <main>
        {view === 'home' && <Home events={events} go={go} />}
        {view === 'events' && (
          <EventsPage events={events} filter={filter} setFilter={setFilter} token={token}
            onNeedLogin={() => go('login')} notify={setToast} />
        )}
        {view === 'login' && !user && <AuthForm onDone={(s) => { saveSession(s); go('home'); }} />}
        {view === 'tickets' && user && <Tickets token={token} notify={setToast} />}
        {view === 'admin' && user?.role === 'admin' && <Admin token={token} reload={loadEvents} events={events || []} />}
      </main>
      <footer className="foot">
        <div className="wrap">Ticketly is a portfolio project built by Naya with React, Node.js and PostgreSQL.</div>
      </footer>
      {toast && <Toast text={toast} onClose={closeToast} />}
    </>
  );
}

function Home({ events, go }) {
  const [q, setQ] = useState('');
  const featured = (events || []).slice(0, 3);
  const count = (c) => (events || []).filter((e) => e.category === c).length;
  const steps = [
    ['1', 'Find an event', 'Search by name or venue, or browse by category.'],
    ['2', 'Choose your tickets', 'Pick how many you need, up to 10 per booking.'],
    ['3', 'Book in seconds', 'Log in once and all your tickets are saved to your account.'],
  ];
  return (
    <>
      <section className="hero">
        <div className="wrap">
          <h2>Find your next live night out</h2>
          <p>Concerts, comedy, theatre, sports and more. Browse upcoming events and book in a few clicks.</p>
          <form className="search" onSubmit={(e) => { e.preventDefault(); go('events', { q }); }}>
            <label className="sr" htmlFor="hq">Search events</label>
            <input id="hq" type="search" placeholder="Search by event or venue" value={q} onChange={(e) => setQ(e.target.value)} />
            <button className="btn primary" type="submit">Search</button>
          </form>
        </div>
      </section>
      <div className="wrap">
        <div className="sec"><h2>Featured events</h2><button className="link" onClick={() => go('events', {})}>See all events</button></div>
        {events === null ? <p className="empty">Loading events…</p> : (
          <div className="cards">
            {featured.map((ev) => (
              <article className="fc" key={ev.id}>
                <Poster id={ev.id} date={ev.starts_at} />
                <div className="fb">
                  <span className="tag">{ev.category}</span>
                  <h3>{ev.title}</h3>
                  <div className="meta"><span>{ev.venue}</span><span>{fmt(ev.starts_at)}</span></div>
                  <div className="row">
                    <span className="price">{money(ev.price_cents)}</span>
                    <button className="btn primary" onClick={() => go('events', { q: ev.title })}>Get tickets</button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
        <div className="sec"><h2>Browse by category</h2></div>
        <div className="cats">
          {CATS.map((c, i) => (
            <button key={c} className={`cat p${i}`} onClick={() => go('events', { cat: c })}>
              <b>{c}</b><span>{count(c)} events</span>
            </button>
          ))}
        </div>
        <div className="sec"><h2>How it works</h2></div>
        <div className="steps">
          {steps.map(([n, t, d]) => (
            <div className="stp" key={n}><span className="num">{n}</span><h3>{t}</h3><p>{d}</p></div>
          ))}
        </div>
        <div className="cta">
          <div><h2>Ready for your next night out?</h2><p>See everything that's coming up.</p></div>
          <button className="btn" onClick={() => go('events', {})}>Browse all events</button>
        </div>
      </div>
    </>
  );
}

function EventsPage({ events, filter, setFilter, token, onNeedLogin, notify }) {
  const [sort, setSort] = useState('date');
  const { q, cat } = filter;
  let list = (events || []).filter(
    (ev) => (cat === 'All' || ev.category === cat) && `${ev.title} ${ev.venue}`.toLowerCase().includes(q.toLowerCase())
  );
  list = [...list].sort((a, b) =>
    sort === 'price' ? a.price_cents - b.price_cents : new Date(a.starts_at) - new Date(b.starts_at));

  return (
    <div className="wrap">
      <div className="sec"><h2>All events</h2>{events && <span className="muted">{list.length} found</span>}</div>
      <div className="filters">
        <label className="sr" htmlFor="eq">Search events</label>
        <input id="eq" type="search" placeholder="Search by event or venue" value={q}
          onChange={(e) => setFilter({ ...filter, q: e.target.value })} />
        <label className="sr" htmlFor="es">Sort by</label>
        <select id="es" value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="date">Soonest first</option>
          <option value="price">Price: low to high</option>
        </select>
      </div>
      <div className="chips" role="group" aria-label="Category">
        {['All', ...CATS].map((c) => (
          <button key={c} className={`chip${cat === c ? ' on' : ''}`} aria-pressed={cat === c}
            onClick={() => setFilter({ ...filter, cat: c })}>{c}</button>
        ))}
      </div>
      {events === null && <p className="empty">Loading events…</p>}
      {events && list.length === 0 && <p className="empty">No events match your search.</p>}
      {list.map((ev) => <EventRow key={ev.id} ev={ev} token={token} onNeedLogin={onNeedLogin} notify={notify} />)}
    </div>
  );
}

function EventRow({ ev, token, onNeedLogin, notify }) {
  const [n, setN] = useState(1);
  const bump = (d) => setN(Math.min(10, Math.max(1, n + d)));

  async function book() {
    if (!token) return onNeedLogin();
    try {
      await api('/bookings', { method: 'POST', token, body: { event_id: ev.id, quantity: n } });
      notify(`Booked ${n} ticket(s) for ${ev.title}. Find them under My tickets.`);
    } catch (e) {
      notify(e.message);
    }
  }

  return (
    <article className="ev">
      <Poster id={ev.id} date={ev.starts_at} />
      <div className="info">
        <span className="tag">{ev.category}</span>
        <h3>{ev.title}</h3>
        <div className="meta"><span>{ev.venue}</span><span>{fmt(ev.starts_at)}</span></div>
        {ev.description && <p>{ev.description}</p>}
      </div>
      <div className="buy">
        <span className="price">{money(ev.price_cents * n)}</span>
        <div className="step" role="group" aria-label={`Tickets for ${ev.title}`}>
          <button onClick={() => bump(-1)} aria-label="Fewer tickets">−</button>
          <span>{n}</span>
          <button onClick={() => bump(1)} aria-label="More tickets">+</button>
        </div>
        <button className="btn primary" onClick={book}>Get tickets</button>
      </div>
    </article>
  );
}

function AuthForm({ onDone }) {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const isLogin = mode === 'login';

  async function submit(e) {
    e.preventDefault();
    setError('');
    try {
      if (!isLogin) await api('/auth/register', { method: 'POST', body: { email, password } });
      const data = await api('/auth/login', { method: 'POST', body: { email, password } });
      onDone({ token: data.token, user: data.user });
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <form className="auth" onSubmit={submit}>
      <h2>{isLogin ? 'Welcome back' : 'Create your account'}</h2>
      <p className="muted">{isLogin ? 'Log in to book tickets and see your bookings.' : 'It takes a few seconds.'}</p>
      <label>Email
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
      </label>
      <label>Password
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
          autoComplete={isLogin ? 'current-password' : 'new-password'} minLength={isLogin ? 1 : 10} required />
      </label>
      {!isLogin && <p className="muted">Use at least 10 characters.</p>}
      {error && <p className="error" role="alert">{error}</p>}
      <button className="btn primary" type="submit">{isLogin ? 'Log in' : 'Create account'}</button>
      <button className="switch" type="button" onClick={() => { setMode(isLogin ? 'register' : 'login'); setError(''); }}>
        {isLogin ? 'New here? Create an account' : 'Already have an account? Log in'}
      </button>
    </form>
  );
}

function Tickets({ token, notify }) {
  const [items, setItems] = useState(null);
  const load = useCallback(() => {
    api('/bookings', { token }).then(setItems).catch((e) => { setItems([]); notify(e.message); });
  }, [token, notify]);
  useEffect(load, [load]);

  async function cancel(id) {
    try { await api(`/bookings/${id}`, { method: 'DELETE', token }); load(); }
    catch (e) { notify(e.message); }
  }

  return (
    <div className="wrap">
      <div className="sec"><h2>My tickets</h2></div>
      {items === null && <p className="empty">Loading your tickets…</p>}
      {items && items.length === 0 && <p className="empty">You have no tickets yet. Browse events to book your first one.</p>}
      {(items || []).map((b) => (
        <article className="ev tk" key={b.id}>
          <Poster id={b.id} date={b.starts_at} />
          <div className="info">
            <h3>{b.title}</h3>
            <div className="meta"><span>{b.venue}</span><span>{fmt(b.starts_at)}</span></div>
            <p className="muted">Booking #{b.id} · {b.quantity} ticket(s)</p>
          </div>
          <div className="buy"><button className="btn danger" onClick={() => cancel(b.id)}>Cancel</button></div>
        </article>
      ))}
    </div>
  );
}

function Admin({ token, reload, events }) {
  const empty = { title: '', venue: '', starts_at: '', price: '', capacity: '', category: 'Music', description: '' };
  const [form, setForm] = useState(empty);
  const [error, setError] = useState('');
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function create(e) {
    e.preventDefault();
    setError('');
    try {
      await api('/events', {
        method: 'POST', token,
        body: {
          title: form.title,
          description: form.description || undefined,
          venue: form.venue,
          category: form.category,
          starts_at: new Date(form.starts_at).toISOString(),
          price_cents: Math.round(Number(form.price) * 100),
          capacity: Number(form.capacity),
        },
      });
      setForm(empty);
      reload();
    } catch (err) {
      setError(err.message);
    }
  }

  async function remove(id) {
    try { await api(`/events/${id}`, { method: 'DELETE', token }); reload(); }
    catch (e) { setError(e.message); }
  }

  return (
    <div className="wrap">
      <div className="sec"><h2>Manage events</h2></div>
      <form className="panel" onSubmit={create}>
        <div className="grid">
          <label className="full">Title<input value={form.title} onChange={set('title')} required /></label>
          <label className="full">Description<input value={form.description} onChange={set('description')} /></label>
          <label>Venue<input value={form.venue} onChange={set('venue')} required /></label>
          <label>Category
            <select value={form.category} onChange={set('category')}>{CATS.map((c) => <option key={c}>{c}</option>)}</select>
          </label>
          <label>Date and time<input type="datetime-local" value={form.starts_at} onChange={set('starts_at')} required /></label>
          <label>Price (USD)<input type="number" step="0.01" min="0" value={form.price} onChange={set('price')} required /></label>
          <label>Capacity<input type="number" min="1" value={form.capacity} onChange={set('capacity')} required /></label>
        </div>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="btn primary" type="submit">Create event</button>
      </form>
      {events.map((ev) => (
        <article className="ev" key={ev.id}>
          <Poster id={ev.id} date={ev.starts_at} />
          <div className="info">
            <h3>{ev.title}</h3>
            <div className="meta"><span>{ev.venue}</span><span>{fmt(ev.starts_at)}</span><span>Capacity {ev.capacity}</span></div>
          </div>
          <div className="buy"><button className="btn danger" onClick={() => remove(ev.id)}>Delete</button></div>
        </article>
      ))}
    </div>
  );
}