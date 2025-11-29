import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Search, Calendar, TrendingUp, TrendingDown, Package, FileText, ShoppingCart, Minus } from 'lucide-react';

interface Product {
  id: string;
  name: string;
  sku: string;
  quantity: number;
}

interface InventoryHistory {
  id: string;
  activity_type: string;
  quantity_before: number;
  quantity_change: number;
  quantity_after: number;
  reference_type: string;
  reference_id: string;
  notes: string;
  created_at: string;
}

interface DailySnapshot {
  snapshot_date: string;
  opening_stock: number;
  purchases: number;
  sales: number;
  adjustments: number;
  closing_stock: number;
  max_stock: number;
}

export function InventoryTrack() {
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [dailySnapshots, setDailySnapshots] = useState<DailySnapshot[]>([]);
  const [inventoryHistory, setInventoryHistory] = useState<InventoryHistory[]>([]);

  const [dateRange, setDateRange] = useState({
    from: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    to: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    loadProducts();
  }, []);

  useEffect(() => {
    if (selectedProduct) {
      loadInventoryData();
    }
  }, [selectedProduct, dateRange]);

  const loadProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, sku, quantity')
        .order('name');

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error('Error loading products:', error);
      alert('Error loading products');
    } finally {
      setLoading(false);
    }
  };

  const loadInventoryData = async () => {
    if (!selectedProduct) return;

    try {
      const { data: snapshots, error: snapshotsError } = await supabase
        .from('daily_inventory_snapshots')
        .select('*')
        .eq('product_id', selectedProduct.id)
        .gte('snapshot_date', dateRange.from)
        .lte('snapshot_date', dateRange.to)
        .order('snapshot_date', { ascending: false });

      if (snapshotsError) throw snapshotsError;
      setDailySnapshots(snapshots || []);

      const { data: history, error: historyError } = await supabase
        .from('inventory_history')
        .select('*')
        .eq('product_id', selectedProduct.id)
        .gte('created_at', `${dateRange.from}T00:00:00`)
        .lte('created_at', `${dateRange.to}T23:59:59`)
        .order('created_at', { ascending: false });

      if (historyError) throw historyError;
      setInventoryHistory(history || []);
    } catch (error) {
      console.error('Error loading inventory data:', error);
      alert('Error loading inventory data');
    }
  };

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    product.sku.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getActivityIcon = (activityType: string) => {
    switch (activityType) {
      case 'purchase':
        return <ShoppingCart className="w-4 h-4 text-green-600" />;
      case 'sale':
        return <FileText className="w-4 h-4 text-blue-600" />;
      case 'consumption':
        return <Minus className="w-4 h-4 text-red-600" />;
      case 'adjustment':
        return <Package className="w-4 h-4 text-orange-600" />;
      default:
        return <Package className="w-4 h-4 text-slate-600" />;
    }
  };

  const getActivityBadge = (activityType: string) => {
    const badges: { [key: string]: string } = {
      purchase: 'bg-green-100 text-green-800',
      sale: 'bg-blue-100 text-blue-800',
      consumption: 'bg-red-100 text-red-800',
      adjustment: 'bg-orange-100 text-orange-800',
      opening_stock: 'bg-slate-100 text-slate-800',
      daily_snapshot: 'bg-purple-100 text-purple-800'
    };
    return badges[activityType] || 'bg-slate-100 text-slate-800';
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Inventory Track</h1>
        <p className="text-slate-600 mt-1">Track daily inventory levels and activity history</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Select Product
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search by name or SKU..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            {searchQuery && (
              <div className="mt-2 max-h-60 overflow-y-auto border border-slate-200 rounded-lg bg-white shadow-lg">
                {filteredProducts.map((product) => (
                  <button
                    key={product.id}
                    onClick={() => {
                      setSelectedProduct(product);
                      setSearchQuery(product.name);
                    }}
                    className="w-full px-4 py-3 text-left hover:bg-blue-50 border-b border-slate-100 last:border-b-0"
                  >
                    <div className="font-medium text-slate-900">{product.name}</div>
                    <div className="text-sm text-slate-600">
                      SKU: {product.sku} | Current Stock: {product.quantity}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                From Date
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
                <input
                  type="date"
                  value={dateRange.from}
                  onChange={(e) => setDateRange({ ...dateRange, from: e.target.value })}
                  className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                To Date
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
                <input
                  type="date"
                  value={dateRange.to}
                  onChange={(e) => setDateRange({ ...dateRange, to: e.target.value })}
                  className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>
        </div>

        {selectedProduct && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <Package className="w-8 h-8 text-blue-600" />
              <div>
                <div className="font-bold text-slate-900">{selectedProduct.name}</div>
                <div className="text-sm text-slate-600">
                  SKU: {selectedProduct.sku} | Current Stock: {selectedProduct.quantity}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {selectedProduct && (
        <>
          <div className="bg-white rounded-xl shadow-sm border border-slate-200">
            <div className="p-6 border-b border-slate-200">
              <h2 className="text-xl font-bold text-slate-900">Daily Inventory Levels</h2>
              <p className="text-sm text-slate-600 mt-1">Maximum stock levels for each day</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-600">Date</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-slate-600">Opening Stock</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-slate-600">Purchases</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-slate-600">Sales / Consumption</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-slate-600">Adjustments</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-slate-600">Max Stock</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-slate-600">Closing Stock</th>
                  </tr>
                </thead>
                <tbody>
                  {dailySnapshots.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                        No data available for selected date range
                      </td>
                    </tr>
                  ) : (
                    dailySnapshots.map((snapshot) => (
                      <tr key={snapshot.snapshot_date} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="px-4 py-3 text-sm font-medium text-slate-900">
                          {new Date(snapshot.snapshot_date).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric'
                          })}
                        </td>
                        <td className="px-4 py-3 text-right text-sm text-slate-900">
                          {parseFloat(snapshot.opening_stock.toString()).toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-right text-sm">
                          {parseFloat(snapshot.purchases.toString()) > 0 && (
                            <span className="inline-flex items-center gap-1 text-green-600 font-medium">
                              <TrendingUp className="w-4 h-4" />
                              {parseFloat(snapshot.purchases.toString()).toFixed(2)}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right text-sm">
                          {parseFloat(snapshot.sales.toString()) > 0 && (
                            <span className="inline-flex items-center gap-1 text-red-600 font-medium">
                              <TrendingDown className="w-4 h-4" />
                              {parseFloat(snapshot.sales.toString()).toFixed(2)}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right text-sm text-slate-900">
                          {parseFloat(snapshot.adjustments.toString()) !== 0 && (
                            <span className={parseFloat(snapshot.adjustments.toString()) > 0 ? 'text-green-600' : 'text-red-600'}>
                              {parseFloat(snapshot.adjustments.toString()) > 0 ? '+' : ''}
                              {parseFloat(snapshot.adjustments.toString()).toFixed(2)}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right text-sm font-bold text-blue-600">
                          {parseFloat(snapshot.max_stock.toString()).toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-right text-sm font-medium text-slate-900">
                          {parseFloat(snapshot.closing_stock.toString()).toFixed(2)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200">
            <div className="p-6 border-b border-slate-200">
              <h2 className="text-xl font-bold text-slate-900">Activity History</h2>
              <p className="text-sm text-slate-600 mt-1">All inventory movements and changes</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-600">Date & Time</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-600">Activity</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-slate-600">Before</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-slate-600">Change</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-slate-600">After</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-600">Reference</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-600">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {inventoryHistory.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                        No activity history for selected date range
                      </td>
                    </tr>
                  ) : (
                    inventoryHistory.map((item) => (
                      <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="px-4 py-3 text-sm text-slate-900">
                          {new Date(item.created_at).toLocaleString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {getActivityIcon(item.activity_type)}
                            <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${getActivityBadge(item.activity_type)}`}>
                              {item.activity_type.replace('_', ' ').toUpperCase()}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right text-sm text-slate-600">
                          {parseFloat(item.quantity_before.toString()).toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-right text-sm font-medium">
                          <span className={parseFloat(item.quantity_change.toString()) > 0 ? 'text-green-600' : 'text-red-600'}>
                            {parseFloat(item.quantity_change.toString()) > 0 ? '+' : ''}
                            {parseFloat(item.quantity_change.toString()).toFixed(2)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-sm font-medium text-slate-900">
                          {parseFloat(item.quantity_after.toString()).toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600">
                          {item.reference_type && (
                            <span className="capitalize">{item.reference_type.replace('_', ' ')}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600">
                          {item.notes}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
