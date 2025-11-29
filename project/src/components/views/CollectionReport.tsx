import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { formatINR } from '../../lib/currency';
import { Calendar, DollarSign, CreditCard, Smartphone, Banknote, TrendingUp, Utensils, ShoppingBag, Truck } from 'lucide-react';

interface PaymentSummary {
  total_cash: number;
  total_upi: number;
  total_card: number;
  total_split_cash: number;
  total_split_upi: number;
  total_split_card: number;
}

interface OrderTypeCollection {
  cash: number;
  upi: number;
  card: number;
  total: number;
}

interface DeliveryPlatformCollection {
  platform: string;
  cash: number;
  upi: number;
  card: number;
  total: number;
}

export function CollectionReport() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [summary, setSummary] = useState<PaymentSummary>({
    total_cash: 0,
    total_upi: 0,
    total_card: 0,
    total_split_cash: 0,
    total_split_upi: 0,
    total_split_card: 0,
  });
  const [dineInCollection, setDineInCollection] = useState<OrderTypeCollection>({ cash: 0, upi: 0, card: 0, total: 0 });
  const [takeawayCollection, setTakeawayCollection] = useState<OrderTypeCollection>({ cash: 0, upi: 0, card: 0, total: 0 });
  const [deliveryCollection, setDeliveryCollection] = useState<OrderTypeCollection>({ cash: 0, upi: 0, card: 0, total: 0 });
  const [deliveryPlatforms, setDeliveryPlatforms] = useState<DeliveryPlatformCollection[]>([]);

  useEffect(() => {
    loadCollectionData();
  }, [startDate, endDate]);

  const loadCollectionData = async () => {
    setLoading(true);
    try {
      const startDateTime = `${startDate}T00:00:00`;
      const endDateTime = `${endDate}T23:59:59`;

      const { data: kots, error } = await supabase
        .from('kots')
        .select('order_type, delivery_platform, payment_method, cash_amount, upi_amount, card_amount, kot_items(quantity, unit_price)')
        .gte('created_at', startDateTime)
        .lte('created_at', endDateTime)
        .eq('status', 'served');

      if (error) throw error;

      let totalCash = 0;
      let totalUpi = 0;
      let totalCard = 0;
      let totalSplitCash = 0;
      let totalSplitUpi = 0;
      let totalSplitCard = 0;

      const dineIn = { cash: 0, upi: 0, card: 0, total: 0 };
      const takeaway = { cash: 0, upi: 0, card: 0, total: 0 };
      const delivery = { cash: 0, upi: 0, card: 0, total: 0 };
      const platformMap: Record<string, DeliveryPlatformCollection> = {};

      kots?.forEach((kot: any) => {
        const kotTotal = kot.kot_items?.reduce(
          (sum: number, item: any) => sum + (parseFloat(item.quantity) * parseFloat(item.unit_price)),
          0
        ) || 0;

        let cashAmount = 0;
        let upiAmount = 0;
        let cardAmount = 0;

        if (kot.payment_method === 'cash') {
          totalCash += kotTotal;
          cashAmount = kotTotal;
        } else if (kot.payment_method === 'upi') {
          totalUpi += kotTotal;
          upiAmount = kotTotal;
        } else if (kot.payment_method === 'card') {
          totalCard += kotTotal;
          cardAmount = kotTotal;
        } else if (kot.payment_method === 'split') {
          cashAmount = parseFloat(kot.cash_amount || 0);
          upiAmount = parseFloat(kot.upi_amount || 0);
          cardAmount = parseFloat(kot.card_amount || 0);
          totalSplitCash += cashAmount;
          totalSplitUpi += upiAmount;
          totalSplitCard += cardAmount;
        }

        if (kot.order_type === 'dine_in') {
          dineIn.cash += cashAmount;
          dineIn.upi += upiAmount;
          dineIn.card += cardAmount;
          dineIn.total += kotTotal;
        } else if (kot.order_type === 'take_away') {
          takeaway.cash += cashAmount;
          takeaway.upi += upiAmount;
          takeaway.card += cardAmount;
          takeaway.total += kotTotal;
        } else if (kot.order_type === 'delivery') {
          delivery.cash += cashAmount;
          delivery.upi += upiAmount;
          delivery.card += cardAmount;
          delivery.total += kotTotal;

          const platform = kot.delivery_platform || 'Manual';
          if (!platformMap[platform]) {
            platformMap[platform] = { platform, cash: 0, upi: 0, card: 0, total: 0 };
          }
          platformMap[platform].cash += cashAmount;
          platformMap[platform].upi += upiAmount;
          platformMap[platform].card += cardAmount;
          platformMap[platform].total += kotTotal;
        }
      });

      setSummary({
        total_cash: totalCash,
        total_upi: totalUpi,
        total_card: totalCard,
        total_split_cash: totalSplitCash,
        total_split_upi: totalSplitUpi,
        total_split_card: totalSplitCard,
      });

      setDineInCollection(dineIn);
      setTakeawayCollection(takeaway);
      setDeliveryCollection(delivery);
      setDeliveryPlatforms(Object.values(platformMap));
    } catch (error) {
      console.error('Error loading collection data:', error);
      alert('Error loading collection data');
    } finally {
      setLoading(false);
    }
  };

  const getTotalCash = () => summary.total_cash + summary.total_split_cash;
  const getTotalUpi = () => summary.total_upi + summary.total_split_upi;
  const getTotalCard = () => summary.total_card + summary.total_split_card;
  const getGrandTotal = () => getTotalCash() + getTotalUpi() + getTotalCard();

  if (loading) {
    return <div className="flex items-center justify-center h-64">Loading...</div>;
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Collection Report</h1>
        <p className="text-slate-600">View payment collections by date, order type and payment method</p>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 mb-6">
        <div className="flex items-center gap-4 mb-6">
          <Calendar className="w-5 h-5 text-slate-600" />
          <h2 className="text-lg font-semibold text-slate-900">Select Date Range</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Start Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              End Date
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg shadow-lg p-6 text-white">
          <div className="flex items-center justify-between mb-4">
            <Banknote className="w-8 h-8 opacity-80" />
            <div className="text-xs font-medium bg-white/20 px-2 py-1 rounded">CASH</div>
          </div>
          <div className="text-3xl font-bold mb-1">{formatINR(getTotalCash())}</div>
          <div className="text-sm opacity-90">
            {summary.total_split_cash > 0 && (
              <div className="mt-2 text-xs">
                Direct: {formatINR(summary.total_cash)} | Split: {formatINR(summary.total_split_cash)}
              </div>
            )}
          </div>
        </div>

        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-lg p-6 text-white">
          <div className="flex items-center justify-between mb-4">
            <Smartphone className="w-8 h-8 opacity-80" />
            <div className="text-xs font-medium bg-white/20 px-2 py-1 rounded">UPI</div>
          </div>
          <div className="text-3xl font-bold mb-1">{formatINR(getTotalUpi())}</div>
          <div className="text-sm opacity-90">
            {summary.total_split_upi > 0 && (
              <div className="mt-2 text-xs">
                Direct: {formatINR(summary.total_upi)} | Split: {formatINR(summary.total_split_upi)}
              </div>
            )}
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg shadow-lg p-6 text-white">
          <div className="flex items-center justify-between mb-4">
            <CreditCard className="w-8 h-8 opacity-80" />
            <div className="text-xs font-medium bg-white/20 px-2 py-1 rounded">CARD</div>
          </div>
          <div className="text-3xl font-bold mb-1">{formatINR(getTotalCard())}</div>
          <div className="text-sm opacity-90">
            {summary.total_split_card > 0 && (
              <div className="mt-2 text-xs">
                Direct: {formatINR(summary.total_card)} | Split: {formatINR(summary.total_split_card)}
              </div>
            )}
          </div>
        </div>

        <div className="bg-gradient-to-br from-slate-700 to-slate-800 rounded-lg shadow-lg p-6 text-white">
          <div className="flex items-center justify-between mb-4">
            <TrendingUp className="w-8 h-8 opacity-80" />
            <div className="text-xs font-medium bg-white/20 px-2 py-1 rounded">TOTAL</div>
          </div>
          <div className="text-3xl font-bold mb-1">{formatINR(getGrandTotal())}</div>
          <div className="text-sm opacity-90">All Payment Methods</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
              <Utensils className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900">Dine-In</h3>
              <p className="text-sm text-slate-600">Restaurant Orders</p>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Cash:</span>
              <span className="font-medium text-green-600">{formatINR(dineInCollection.cash)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">UPI:</span>
              <span className="font-medium text-blue-600">{formatINR(dineInCollection.upi)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Card:</span>
              <span className="font-medium text-purple-600">{formatINR(dineInCollection.card)}</span>
            </div>
            <div className="pt-2 border-t border-slate-200">
              <div className="flex justify-between">
                <span className="font-semibold text-slate-900">Total:</span>
                <span className="font-bold text-lg text-orange-600">{formatINR(dineInCollection.total)}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-teal-100 rounded-lg flex items-center justify-center">
              <ShoppingBag className="w-6 h-6 text-teal-600" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900">Takeaway</h3>
              <p className="text-sm text-slate-600">Pickup Orders</p>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Cash:</span>
              <span className="font-medium text-green-600">{formatINR(takeawayCollection.cash)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">UPI:</span>
              <span className="font-medium text-blue-600">{formatINR(takeawayCollection.upi)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Card:</span>
              <span className="font-medium text-purple-600">{formatINR(takeawayCollection.card)}</span>
            </div>
            <div className="pt-2 border-t border-slate-200">
              <div className="flex justify-between">
                <span className="font-semibold text-slate-900">Total:</span>
                <span className="font-bold text-lg text-teal-600">{formatINR(takeawayCollection.total)}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
              <Truck className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900">Delivery</h3>
              <p className="text-sm text-slate-600">All Platforms</p>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Cash:</span>
              <span className="font-medium text-green-600">{formatINR(deliveryCollection.cash)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">UPI:</span>
              <span className="font-medium text-blue-600">{formatINR(deliveryCollection.upi)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Card:</span>
              <span className="font-medium text-purple-600">{formatINR(deliveryCollection.card)}</span>
            </div>
            <div className="pt-2 border-t border-slate-200">
              <div className="flex justify-between">
                <span className="font-semibold text-slate-900">Total:</span>
                <span className="font-bold text-lg text-red-600">{formatINR(deliveryCollection.total)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {deliveryPlatforms.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 mb-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Delivery Platform Breakdown</h3>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-600">Platform</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-slate-600">Cash</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-slate-600">UPI</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-slate-600">Card</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-slate-600">Total</th>
                </tr>
              </thead>
              <tbody>
                {deliveryPlatforms.map((platform, index) => (
                  <tr key={index} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <span className="font-medium text-slate-900 capitalize">{platform.platform}</span>
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-green-600 font-medium">
                      {formatINR(platform.cash)}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-blue-600 font-medium">
                      {formatINR(platform.upi)}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-purple-600 font-medium">
                      {formatINR(platform.card)}
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-bold text-slate-900">
                      {formatINR(platform.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 font-semibold">
                  <td className="px-4 py-3 text-slate-900">Total Delivery</td>
                  <td className="px-4 py-3 text-right text-green-700">{formatINR(deliveryCollection.cash)}</td>
                  <td className="px-4 py-3 text-right text-blue-700">{formatINR(deliveryCollection.upi)}</td>
                  <td className="px-4 py-3 text-right text-purple-700">{formatINR(deliveryCollection.card)}</td>
                  <td className="px-4 py-3 text-right text-slate-900 text-lg">{formatINR(deliveryCollection.total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Overall Summary</h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-green-50 rounded-lg border border-green-200">
            <div className="flex items-center gap-2 mb-2">
              <Banknote className="w-5 h-5 text-green-600" />
              <span className="font-semibold text-slate-900">Cash</span>
            </div>
            <div className="text-2xl font-bold text-green-600 mb-1">{formatINR(getTotalCash())}</div>
            <div className="text-xs text-slate-600">
              Direct: {formatINR(summary.total_cash)} | Split: {formatINR(summary.total_split_cash)}
            </div>
          </div>

          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex items-center gap-2 mb-2">
              <Smartphone className="w-5 h-5 text-blue-600" />
              <span className="font-semibold text-slate-900">UPI</span>
            </div>
            <div className="text-2xl font-bold text-blue-600 mb-1">{formatINR(getTotalUpi())}</div>
            <div className="text-xs text-slate-600">
              Direct: {formatINR(summary.total_upi)} | Split: {formatINR(summary.total_split_upi)}
            </div>
          </div>

          <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
            <div className="flex items-center gap-2 mb-2">
              <CreditCard className="w-5 h-5 text-purple-600" />
              <span className="font-semibold text-slate-900">Card</span>
            </div>
            <div className="text-2xl font-bold text-purple-600 mb-1">{formatINR(getTotalCard())}</div>
            <div className="text-xs text-slate-600">
              Direct: {formatINR(summary.total_card)} | Split: {formatINR(summary.total_split_card)}
            </div>
          </div>
        </div>

        <div className="mt-4 p-4 bg-slate-100 rounded-lg border-2 border-slate-300">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <DollarSign className="w-6 h-6 text-slate-700" />
              <div>
                <div className="font-bold text-slate-900 text-lg">Grand Total</div>
                <div className="text-sm text-slate-600">
                  From {new Date(startDate).toLocaleDateString()} to {new Date(endDate).toLocaleDateString()}
                </div>
              </div>
            </div>
            <div className="text-3xl font-bold text-slate-900">{formatINR(getGrandTotal())}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
