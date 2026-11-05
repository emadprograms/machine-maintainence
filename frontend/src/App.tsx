import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth, Role } from './context/AuthContext';
import { ToastProvider } from './components/ui/Toast';
import Chatbot from './components/ui/Chatbot';
import Layout from './components/layout/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import EquipmentList from './pages/EquipmentList';
import EquipmentDetail from './pages/EquipmentDetail';
import KanbanBoard from './pages/KanbanBoard';
import FaultDetail from './pages/FaultDetail';
import SpareParts from './pages/SpareParts';
import Notifications from './pages/Notifications';
import Scan from './pages/Scan';
import Sites from './pages/Sites';
import Profile from './pages/Profile';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminUsers from './pages/admin/AdminUsers';
import AdminCompanies from './pages/admin/AdminCompanies';
import AdminBreakdowns from './pages/admin/AdminBreakdowns';
import AdminAudit from './pages/admin/AdminAudit';
import AdminSettings from './pages/admin/AdminSettings';
import MyTasks from './pages/technician/MyTasks';
import MaintenanceCalendar from './pages/technician/MaintenanceCalendar';
import Portal from './pages/client/Portal';
import MyRequests from './pages/client/MyRequests';
import MyEquipment from './pages/client/MyEquipment';
import Onboarding from './pages/client/Onboarding';

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-canvas">
        <div className="w-8 h-8 border-[2.5px] border-brand-500/25 border-t-brand-500 rounded-full animate-spin" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  if (user.role === 'client' && user.first_login === 1 && !location.pathname.startsWith('/onboarding')) {
    return <Navigate to="/onboarding" replace />;
  }
  return <>{children}</>;
}

function RequireRole({ roles, children }: { roles: Role[]; children: React.ReactNode }) {
  const { user, homePath } = useAuth();
  if (!user || !roles.includes(user.role)) return <Navigate to={homePath} replace />;
  return <>{children}</>;
}

function HomeRedirect() {
  const { homePath } = useAuth();
  return <Navigate to={homePath} replace />;
}

function PublicOnly({ children }: { children: React.ReactNode }) {
  const { user, loading, homePath } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to={homePath} replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Routes>
          <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
          <Route element={<RequireAuth><Layout /></RequireAuth>}>
            <Route path="/" element={<HomeRedirect />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/scan" element={<Scan />} />
            <Route path="/sites" element={<Sites />} />
            <Route path="/equipment" element={<EquipmentList />} />
            <Route path="/equipment/:id" element={<EquipmentDetail />} />
            <Route path="/kanban" element={<KanbanBoard />} />
            <Route path="/faults/:id" element={<FaultDetail />} />
            <Route path="/spare-parts" element={<SpareParts />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/profile" element={<Profile />} />
            {/* Admin */}
            <Route path="/admin/dashboard" element={<RequireRole roles={['admin']}><AdminDashboard /></RequireRole>} />
            <Route path="/admin/users" element={<RequireRole roles={['admin']}><AdminUsers /></RequireRole>} />
            <Route path="/admin/companies" element={<RequireRole roles={['admin']}><AdminCompanies /></RequireRole>} />
            <Route path="/admin/breakdowns" element={<RequireRole roles={['admin']}><AdminBreakdowns /></RequireRole>} />
            <Route path="/admin/audit" element={<RequireRole roles={['admin']}><AdminAudit /></RequireRole>} />
            <Route path="/admin/settings" element={<RequireRole roles={['admin']}><AdminSettings /></RequireRole>} />
            {/* Technician */}
            <Route path="/my-tasks" element={<RequireRole roles={['technician']}><MyTasks /></RequireRole>} />
            <Route path="/my-tasks/calendar" element={<RequireRole roles={['technician']}><MaintenanceCalendar /></RequireRole>} />
            {/* Client */}
            <Route path="/portal" element={<RequireRole roles={['client']}><Portal /></RequireRole>} />
            <Route path="/my-requests" element={<RequireRole roles={['client']}><MyRequests /></RequireRole>} />
            <Route path="/my-equipment" element={<RequireRole roles={['client']}><MyEquipment /></RequireRole>} />
            <Route path="/onboarding" element={<RequireRole roles={['client']}><Onboarding /></RequireRole>} />
          </Route>
          <Route path="*" element={<HomeRedirect />} />
          </Routes>
          <Chatbot />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
