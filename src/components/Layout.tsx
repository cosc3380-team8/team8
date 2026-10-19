import { ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { Badge } from './ui';

interface NavItem { to: string; label: string }

export default function Layout({ children }: { children: ReactNode }) {
  const { session, logout, isStaff, isAdmin } = useAuth();
  const navigate = useNavigate();

  const items: NavItem[] = [
    { to: '/', label: isStaff ? 'Dashboard' : 'My Library' },
    { to: '/catalog', label: 'Catalog' },
    { to: '/rooms', label: 'Study Rooms' },
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
    </NavLink>
  );

  return (
    <div className="shell">
      <aside className="sidebar">
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
      <main className="content">{children}</main>
    </div>
  );
}
