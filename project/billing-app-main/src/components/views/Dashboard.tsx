import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Package, FileText, Users, DollarSign, TrendingUp, TrendingDown } from 'lucide-react';
import { formatINR } from '../../lib/currency';

interface Stats {
  totalProducts: number;
  lowStockProducts: number;
  totalInvoices: number;
  totalRevenue: number;
  pendingInvoices: number;
  totalCustomers: number;
}

interface DashboardProps {
  setCurrentView: (view: string) => void;
}

export function Dashboard({ setCurrentView }: DashboardProps) {
  const [stats, setStats] = useState<Stats>({
    totalProducts: 0,
    lowStockProducts: 0,
    totalInvoices: 0,
    totalRevenue: 0,
    pendingInvoices: 0,
    totalCustomers: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const [products, invoices, customers] = await Promise.all([
        supabase.from('products').select('quantity, reorder_level'),
        supabase.from('invoices').select('status, total'),
        supabase.from('customers').select('id', { count: 'exact', head: true }),
      ]);

      const totalProducts = products.data?.length || 0;
      const lowStockProducts = products.data?.filter(p => p.quantity <= p.reorder_level).length || 0;

      const totalInvoices = invoices.data?.length || 0;
      const pendingInvoices = invoices.data?.filter(i => i.status !== 'paid').length || 0;
      const totalRevenue = invoices.data?.reduce((sum, inv) => sum + (inv.status === 'paid' ? Number(inv.total) : 0), 0) || 0;

      const totalCustomers = customers.count || 0;

      setStats({
        totalProducts,
        lowStockProducts,
        totalInvoices,
        totalRevenue,
        pendingInvoices,
        totalCustomers,
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    {
      title: 'Total Revenue',
      value: formatINR(stats.totalRevenue),
      icon: DollarSign,
      color: 'bg-green-500',
      trend: '+12%',
      trendUp: true,
    },
    {
      title: 'Total Products',
      value: stats.totalProducts.toString(),
      icon: Package,
      color: 'bg-blue-500',
      subtitle: `${stats.lowStockProducts} low stock`,
    },
    {
      title: 'Total Invoices',
      value: stats.totalInvoices.toString(),
      icon: FileText,
      color: 'bg-orange-500',
      subtitle: `${stats.pendingInvoices} pending`,
    },
    {
      title: 'Total Customers',
      value: stats.totalCustomers.toString(),
      icon: Users,
      color: 'bg-purple-500',
      trend: '+8%',
      trendUp: true,
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-600">Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.title} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className={`${card.color} p-3 rounded-lg`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
                {card.trend && (
                  <div className={`flex items-center gap-1 text-sm font-medium ${card.trendUp ? 'text-green-600' : 'text-red-600'}`}>
                    {card.trendUp ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                    {card.trend}
                  </div>
                )}
              </div>
              <h3 className="text-slate-600 text-sm font-medium mb-1">{card.title}</h3>
              <p className="text-3xl font-bold text-slate-900">{card.value}</p>
              {card.subtitle && (
                <p className="text-sm text-slate-500 mt-2">{card.subtitle}</p>
              )}
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h3 className="text-lg font-bold text-slate-900 mb-4">Quick Actions</h3>
          <div className="space-y-3">
            <button
              onClick={() => setCurrentView('invoices')}
              className="w-full px-4 py-3 bg-blue-50 hover:bg-blue-100 text-blue-700 font-medium rounded-lg transition text-left"
            >
              Create New Invoice
            </button>
            <button
              onClick={() => setCurrentView('inventory')}
              className="w-full px-4 py-3 bg-green-50 hover:bg-green-100 text-green-700 font-medium rounded-lg transition text-left"
            >
              Add New Product
            </button>
            <button
              onClick={() => setCurrentView('customers')}
              className="w-full px-4 py-3 bg-orange-50 hover:bg-orange-100 text-orange-700 font-medium rounded-lg transition text-left"
            >
              Add New Customer
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h3 className="text-lg font-bold text-slate-900 mb-4">Recent Activity</h3>
          <div className="space-y-4">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
              <div className="bg-blue-100 p-2 rounded-lg">
                <FileText className="w-4 h-4 text-blue-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-slate-900">New invoice created</p>
                <p className="text-xs text-slate-500">2 hours ago</p>
              </div>
            </div>
            <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
              <div className="bg-green-100 p-2 rounded-lg">
                <Package className="w-4 h-4 text-green-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-slate-900">Product stock updated</p>
                <p className="text-xs text-slate-500">5 hours ago</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="bg-orange-100 p-2 rounded-lg">
                <Users className="w-4 h-4 text-orange-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-slate-900">New customer added</p>
                <p className="text-xs text-slate-500">1 day ago</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
