import { ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth/AuthContext';
import Layout from './components/Layout';
import type { Role } from './types';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import DashboardPage from './pages/DashboardPage';
import CatalogPage from './pages/CatalogPage';
import RoomsPage from './pages/RoomsPage';
import CirculationPage from './pages/CirculationPage';
import ManageBooksPage from './pages/ManageBooksPage';
import ManageMediaPage from './pages/ManageMediaPage';
import ManageRoomsPage from './pages/ManageRoomsPage';
import MembersPage from './pages/MembersPage';
import StaffPage from './pages/StaffPage';
import QueriesPage from './pages/QueriesPage';
import ReportsPage from './pages/ReportsPage';
import TriggersPage from './pages/TriggersPage';

function RequireRole({ roles, children }: { roles?: Role[]; children: ReactNode }) {
  const { session } = useAuth();
  if (!session) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(session.role)) {
    return <div className="card"><h2>Access denied</h2><p className="muted">Your role ({session.role}) cannot open this page.</p></div>;
  }
  return <>{children}</>;
}

const STAFF: Role[] = ['employee', 'admin'];

export default function App() {
  const { session } = useAuth();
  const page = (el: ReactNode, roles?: Role[]) => (
    <RequireRole roles={roles}><Layout>{el}</Layout></RequireRole>
  );
  return (
    <Routes>
      <Route path="/login" element={session ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route path="/signup" element={session ? <Navigate to="/" replace /> : <SignupPage />} />
      <Route path="/" element={page(<DashboardPage />)} />
      <Route path="/catalog" element={page(<CatalogPage />)} />
      <Route path="/rooms" element={page(<RoomsPage />)} />
      <Route path="/circulation" element={page(<CirculationPage />, STAFF)} />
      <Route path="/manage/books" element={page(<ManageBooksPage />, STAFF)} />
      <Route path="/manage/media" element={page(<ManageMediaPage />, STAFF)} />
      <Route path="/manage/rooms" element={page(<ManageRoomsPage />, STAFF)} />
      <Route path="/members" element={page(<MembersPage />, STAFF)} />
      <Route path="/staff" element={page(<StaffPage />, ['admin'])} />
      <Route path="/queries" element={page(<QueriesPage />, STAFF)} />
      <Route path="/reports" element={page(<ReportsPage />, STAFF)} />
      <Route path="/triggers" element={page(<TriggersPage />, STAFF)} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
