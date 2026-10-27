import { ReactNode, useEffect, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import * as api from '../api/api';
import { useAuth } from '../auth/AuthContext';
import { Badge } from './ui';

interface NavItem { to: string; label: string; count?: number }

export default function Layout({ children }: { children: ReactNode }) {
  const { session, logout, isStaff, isAdmin, isPatron } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [unread, setUnread] = useState(0);
  const [navOpen, setNavOpen] = useState(() => {
    try { return localStorage.getItem('navOpen') !== 'false'; } catch { return true; }
  });

  useEffect(() => {
    try { localStorage.setItem('navOpen', String(navOpen)); } catch { /* ignore */ }
  }, [navOpen]);

  useEffect(() => {
    if (!isPatron || !session) return;
    const refresh = () => { api.unreadNotificationCount(session.id).then(setUnread); };
    refresh();
    window.addEventListener('notifications-changed', refresh);
    return () => window.removeEventListener('notifications-changed', refresh);
  }, [isPatron, session, location.pathname]);

  const items: NavItem[] = [
    { to: '/', label: isStaff ? 'Dashboard' : 'My Library' },
    ...(isPatron ? [{ to: '/notifications', label: 'Notifications', count: unread }] : []),
    { to: '/catalog', label: 'Catalog' },
    { to: '/rooms', label: 'Study Rooms' },
    { to: '/receipts', label: isStaff ? 'Receipts' : 'My Receipts' },
  ];
  const staffItems: NavItem[] = [
    { to: '/circulation', label: 'Circulation' },
    { to: '/manage/books', label: 'Manage Books' },
    { to: '/manage/media', label: 'Manage Media' },
    { to: '/manage/rooms', label: 'Manage Rooms' },
    { to: '/members', label: 'Members' },
    ...(isAdmin ? [{ to: '/staff', label: 'Staff (admin)' }] : []),
  ];
  const insightItems: NavItem[] = [
    { to: '/queries', label: 'Queries' },
    { to: '/reports', label: 'Reports' },
    { to: '/triggers', label: 'Triggers & Audit Log' },
  ];

  const link = (n: NavItem) => (
    <NavLink key={n.to} to={n.to} end={n.to === '/'} className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
      {n.label}
      {!!n.count && <span className="nav-count" aria-label={`${n.count} unread`}>{n.count}</span>}
    </NavLink>
  );

  return (
    <div className={navOpen ? 'shell' : 'shell nav-closed'}>
      <button className="nav-toggle" onClick={() => setNavOpen((o) => !o)}
        aria-label={navOpen ? 'Close menu' : 'Open menu'} aria-expanded={navOpen} aria-controls="sidebar">
        <span /><span /><span />
      </button>
      <main className="content-area"><div className="content">{children}</div></main>
      <aside className="sidebar" id="sidebar" hidden={!navOpen}>
        <div className="brand">
          <div className="mascot-box"><img src="/mascot.png" alt="Uma's Library cougar mascot" /></div>
          Uma’s Library<br /><span>Library Database System</span>
        </div>
        <nav>
          {items.map(link)}
          {isStaff && (
            <>
              <div className="nav-group">Staff tools</div>
              {staffItems.map(link)}
            </>
          )}
          {isAdmin && (
            <>
              <div className="nav-group">Insights</div>
              {insightItems.map(link)}
            </>
          )}
        </nav>
        <div className="sidebar-foot">
          <div className="who">
            <strong>{session?.name}</strong>
            <Badge tone={isAdmin ? 'red' : isStaff ? 'blue' : 'green'}>{session?.role}</Badge>
          </div>
          <button className="btn small" onClick={() => { logout(); navigate('/login'); }}>Sign out</button>
        </div>
      </aside>
    </div>
  );
}
