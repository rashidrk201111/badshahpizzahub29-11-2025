import { ReactNode, useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import {
  LayoutDashboard,
  Package,
  FileText,
  Users,
  BarChart3,
  Building2,
  LogOut,
  Menu,
  X,
  Receipt,
  ShoppingCart,
  Truck,
  User,
  UtensilsCrossed,
  ClipboardList,
  Activity,
  Wallet,
} from 'lucide-react';

interface DashboardLayoutProps {
  children: (props: { currentView: string; setCurrentView: (view: string) => void }) => ReactNode;
}

interface NavItem {
  name: string;
  icon: typeof LayoutDashboard;
  path: string;
  roles: string[];
}

const navItems: NavItem[] = [
  { name: 'Dashboard', icon: LayoutDashboard, path: 'dashboard', roles: ['admin', 'inventory_person', 'purchase_person'] },
  { name: 'Inventory', icon: Package, path: 'inventory', roles: ['admin', 'inventory_person'] },
  { name: 'Inventory Track', icon: Activity, path: 'inventory-track', roles: ['admin', 'inventory_person'] },
  { name: 'Menu', icon: UtensilsCrossed, path: 'menu', roles: ['admin', 'inventory_person', 'sales_person'] },
  { name: 'KOT', icon: ClipboardList, path: 'kot', roles: ['admin', 'sales_person'] },
  { name: 'Collection Report', icon: Wallet, path: 'collection-report', roles: ['admin'] },
  { name: 'Invoices', icon: FileText, path: 'invoices', roles: ['admin', 'sales_person'] },
  { name: 'Payment Receivables', icon: Receipt, path: 'receivables', roles: ['admin'] },
  { name: 'Customers', icon: Users, path: 'customers', roles: ['admin'] },
  { name: 'Suppliers', icon: Truck, path: 'suppliers', roles: ['admin', 'purchase_person', 'inventory_person'] },
  { name: 'Purchases', icon: ShoppingCart, path: 'purchases', roles: ['admin', 'purchase_person', 'inventory_person'] },
  { name: 'Accounting', icon: BarChart3, path: 'accounting', roles: ['admin'] },
  { name: 'Employees', icon: User, path: 'employees', roles: ['admin'] },
  { name: 'Company Profile', icon: Building2, path: 'profile', roles: ['admin'] },
];

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { profile, signOut } = useAuth();
  const getDefaultView = () => {
    if (profile?.role === 'sales_person') {
      return 'kot';
    }
    return 'dashboard';
  };
  const [currentView, setCurrentView] = useState(getDefaultView());
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [companyName, setCompanyName] = useState('BizManager');

  useEffect(() => {
    const loadCompanyName = async () => {
      try {
        const { data, error } = await supabase
          .from('company_profile')
          .select('company_name')
          .maybeSingle();

        if (data?.company_name) {
          setCompanyName(data.company_name);
        }
      } catch (error) {
        console.error('Error loading company name:', error);
      }
    };

    loadCompanyName();
  }, []);

  const filteredNavItems = navItems.filter(item =>
    item.roles.includes(profile?.role || '')
  );

  const handleSignOut = async () => {
    try {
      await signOut();
      window.location.reload();
    } catch (error) {
      console.error('Error signing out:', error);
      alert('Failed to sign out. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="flex">
        <aside
          className={`fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out lg:translate-x-0 ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="h-full flex flex-col">
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-slate-900">{companyName}</h1>
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="lg:hidden text-slate-600 hover:text-slate-900"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="mt-4">
                <p className="text-sm font-medium text-slate-900">{profile?.full_name}</p>
                <p className="text-xs text-slate-500 capitalize">{profile?.role?.replace('_', ' ')}</p>
              </div>
            </div>

            <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
              {filteredNavItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.path}
                    onClick={() => {
                      setCurrentView(item.path);
                      setSidebarOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition ${
                      currentView === item.path
                        ? 'bg-blue-50 text-blue-600'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="font-medium">{item.name}</span>
                  </button>
                );
              })}
            </nav>

            <div className="p-4 border-t border-slate-200 space-y-2">
              <button
                onClick={() => {
                  setCurrentView('manage-profile');
                  setSidebarOpen(false);
                }}
                className="w-full flex items-center gap-3 px-4 py-3 text-slate-700 hover:bg-slate-100 rounded-lg transition"
              >
                <User className="w-5 h-5" />
                <span className="font-medium">Manage Profile</span>
              </button>
              <button
                onClick={handleSignOut}
                className="w-full flex items-center gap-3 px-4 py-3 text-slate-700 hover:bg-slate-100 rounded-lg transition"
              >
                <LogOut className="w-5 h-5" />
                <span className="font-medium">Sign Out</span>
              </button>
            </div>
          </div>
        </aside>

        <div className="flex-1 lg:ml-64">
          <header className="bg-white shadow-sm border-b border-slate-200">
            <div className="px-6 py-4 flex items-center justify-between">
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden text-slate-600 hover:text-slate-900"
              >
                <Menu className="w-6 h-6" />
              </button>
              <h2 className="text-2xl font-bold text-slate-900 capitalize">
                {currentView.replace('_', ' ')}
              </h2>
              <div className="w-10 lg:hidden"></div>
            </div>
          </header>

          <main className="p-6">
            {children({ currentView, setCurrentView })}
          </main>
        </div>
      </div>

      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
}
