import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LoginForm } from './components/auth/LoginForm';
import { DashboardLayout } from './components/layout/DashboardLayout';
import { Dashboard } from './components/views/Dashboard';
import { Inventory } from './components/views/Inventory';
import { Invoices } from './components/views/Invoices';
import { Customers } from './components/views/Customers';
import { Accounting } from './components/views/Accounting';
import { CompanyProfile } from './components/views/CompanyProfile';
import { PaymentReceivables } from './components/views/PaymentReceivables';
import { Suppliers } from './components/views/Suppliers';
import { Purchases } from './components/views/Purchases';
import { ManageProfile } from './components/views/ManageProfile';
import { Employees } from './components/views/Employees';
import { PublicInvoice } from './components/views/PublicInvoice';

function AppContent() {
  const { user, profile, loading } = useAuth();

  if (window.location.pathname === '/invoice' || window.location.search.includes('id=')) {
    return <PublicInvoice />;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-slate-600 text-lg">Loading...</div>
      </div>
    );
  }

  if (!user || !profile) {
    return <LoginForm />;
  }

  return (
    <DashboardLayout>
      {({ currentView, setCurrentView }) => {
        switch (currentView) {
          case 'dashboard':
            return <Dashboard setCurrentView={setCurrentView} />;
          case 'inventory':
            return <Inventory />;
          case 'invoices':
            return <Invoices />;
          case 'customers':
            return <Customers />;
          case 'accounting':
            return <Accounting />;
          case 'receivables':
            return <PaymentReceivables />;
          case 'suppliers':
            return <Suppliers />;
          case 'purchases':
            return <Purchases />;
          case 'employees':
            return <Employees />;
          case 'profile':
            return <CompanyProfile />;
          case 'manage-profile':
            return <ManageProfile />;
          default:
            return <Dashboard setCurrentView={setCurrentView} />;
        }
      }}
    </DashboardLayout>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
