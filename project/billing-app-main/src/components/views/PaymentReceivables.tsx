import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Plus, Search, AlertCircle, CheckCircle, Clock, IndianRupee, Calendar, User } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { formatINR } from '../../lib/currency';

interface Customer {
  name: string;
  phone: string;
  opening_balance: number;
}

interface Invoice {
  id: string;
  invoice_number: string;
  customer_id: string;
  total: number;
  amount_paid: number;
  payment_status: 'unpaid' | 'partial' | 'paid' | 'overdue';
  due_date: string;
  created_at: string;
  customer?: Customer;
}

interface InvoicePayment {
  id: string;
  invoice_id: string;
  amount: number;
  payment_date: string;
  reference_number: string | null;
  notes: string | null;
  created_at: string;
  payment_method?: { name: string };
}

interface Transaction {
  id: string;
  type: 'income' | 'expense';
  category: string;
  amount: number;
  description: string | null;
  invoice_id: string | null;
  transaction_date: string;
  created_at: string;
  payment_method?: { name: string };
  reference_number: string | null;
}

export function PaymentReceivables() {
  const { profile } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<InvoicePayment[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'unpaid' | 'partial' | 'overdue'>('all');
  const [showModal, setShowModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [formData, setFormData] = useState({
    amount: '',
    payment_date: new Date().toISOString().split('T')[0],
    payment_method_id: '',
    reference_number: '',
    notes: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [invoicesData, paymentsData, methodsData, transactionsData] = await Promise.all([
        supabase
          .from('invoices')
          .select(`
            *,
            customer:customers(name, phone, opening_balance)
          `)
          .neq('payment_status', 'paid')
          .order('due_date', { ascending: true }),
        supabase
          .from('invoice_payments')
          .select(`
            *,
            payment_method:payment_methods(name)
          `)
          .order('payment_date', { ascending: false }),
        supabase
          .from('payment_methods')
          .select('*')
          .eq('is_active', true)
          .order('name'),
        supabase
          .from('transactions')
          .select(`
            *,
            payment_method:payment_methods(name)
          `)
          .not('invoice_id', 'is', null)
          .order('transaction_date', { ascending: false }),
      ]);

      if (invoicesData.error) throw invoicesData.error;
      if (paymentsData.error) throw paymentsData.error;
      if (methodsData.error) throw methodsData.error;
      if (transactionsData.error) throw transactionsData.error;

      setInvoices(invoicesData.data || []);
      setPayments(paymentsData.data || []);
      setTransactions(transactionsData.data || []);
      setPaymentMethods(methodsData.data || []);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoice) return;

    try {
      const paymentAmount = parseFloat(formData.amount);
      const remainingAmount = selectedInvoice.total - selectedInvoice.amount_paid;

      if (paymentAmount <= 0) {
        alert('Payment amount must be greater than 0');
        return;
      }

      if (paymentAmount > remainingAmount) {
        alert(`Payment amount cannot exceed remaining balance of ${formatINR(remainingAmount)}`);
        return;
      }

      const { error: paymentError } = await supabase
        .from('invoice_payments')
        .insert([{
          invoice_id: selectedInvoice.id,
          amount: paymentAmount,
          payment_date: formData.payment_date,
          payment_method_id: formData.payment_method_id || null,
          reference_number: formData.reference_number || null,
          notes: formData.notes || null,
          created_by: profile?.id,
        }]);

      if (paymentError) throw paymentError;

      const newAmountPaid = selectedInvoice.amount_paid + paymentAmount;
      const newPaymentStatus =
        newAmountPaid >= selectedInvoice.total ? 'paid' :
        newAmountPaid > 0 ? 'partial' : 'unpaid';

      const { error: invoiceError } = await supabase
        .from('invoices')
        .update({
          amount_paid: newAmountPaid,
          payment_status: newPaymentStatus,
          status: newPaymentStatus === 'paid' ? 'paid' : 'sent',
          paid_date: newPaymentStatus === 'paid' ? new Date().toISOString().split('T')[0] : null,
        })
        .eq('id', selectedInvoice.id);

      if (invoiceError) throw invoiceError;


      if (selectedInvoice.payment_status === 'unpaid' && (newPaymentStatus === 'partial' || newPaymentStatus === 'paid')) {
        const { data: invoiceItems, error: itemsError } = await supabase
          .from('invoice_items')
          .select('product_id, quantity')
          .eq('invoice_id', selectedInvoice.id);

        if (itemsError) throw itemsError;

        const currentPaidInvoice = await supabase
          .from('invoices')
          .select('invoice_number')
          .eq('id', selectedInvoice.id)
          .single();

        for (const item of invoiceItems || []) {
          const { data: product } = await supabase
            .from('products')
            .select('quantity')
            .eq('id', item.product_id)
            .single();

          if (product) {
            const newQuantity = product.quantity - item.quantity;

            await supabase
              .from('products')
              .update({ quantity: newQuantity })
              .eq('id', item.product_id);

            await supabase
              .from('inventory_movements')
              .insert([{
                product_id: item.product_id,
                type: 'out',
                quantity: item.quantity,
                reason: `Invoice ${currentPaidInvoice.data?.invoice_number} - first payment received`,
                created_by: profile?.id,
              }]);
          }
        }
      }

      const { error: transactionError } = await supabase
        .from('transactions')
        .insert([{
          type: 'income',
          category: 'Product Sales',
          amount: paymentAmount,
          description: `Payment for Invoice ${selectedInvoice.invoice_number}`,
          transaction_date: formData.payment_date,
          payment_method_id: formData.payment_method_id || null,
          reference_number: formData.reference_number || null,
          invoice_id: selectedInvoice.id,
          created_by: profile?.id,
        }]);

      if (transactionError) throw transactionError;

      setShowModal(false);
      setSelectedInvoice(null);
      setFormData({
        amount: '',
        payment_date: new Date().toISOString().split('T')[0],
        payment_method_id: '',
        reference_number: '',
        notes: '',
      });
      loadData();
    } catch (error) {
      console.error('Error adding payment:', error);
      alert('Error adding payment: ' + (error as Error).message);
    }
  };

  const filteredInvoices = invoices.filter(invoice => {
    const matchesSearch =
      invoice.invoice_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invoice.customer?.name.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesFilter = filterStatus === 'all' || invoice.payment_status === filterStatus;

    const isOverdue = new Date(invoice.due_date) < new Date() && invoice.payment_status !== 'paid';
    const matchesOverdue = filterStatus === 'overdue' ? isOverdue : true;

    return matchesSearch && matchesFilter && matchesOverdue;
  });

  const totalReceivable = filteredInvoices.reduce((sum, inv) => sum + (inv.total - inv.amount_paid) + (inv.customer?.opening_balance || 0), 0);
  const totalOverdue = filteredInvoices
    .filter(inv => new Date(inv.due_date) < new Date() && inv.payment_status !== 'paid')
    .reduce((sum, inv) => sum + (inv.total - inv.amount_paid) + (inv.customer?.opening_balance || 0), 0);

  const getStatusBadge = (invoice: Invoice) => {
    const isOverdue = new Date(invoice.due_date) < new Date();

    if (isOverdue && invoice.payment_status !== 'paid') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
          <AlertCircle className="w-3 h-3" />
          Overdue
        </span>
      );
    }

    switch (invoice.payment_status) {
      case 'unpaid':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
            <Clock className="w-3 h-3" />
            Unpaid
          </span>
        );
      case 'partial':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
            <Clock className="w-3 h-3" />
            Partial
          </span>
        );
      case 'paid':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
            <CheckCircle className="w-3 h-3" />
            Paid
          </span>
        );
      default:
        return null;
    }
  };

  if (loading) {
    return <div className="text-center py-8">Loading payment receivables...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl shadow-lg p-6 text-white">
          <div className="flex items-center justify-between mb-4">
            <div className="bg-white bg-opacity-20 p-3 rounded-lg">
              <IndianRupee className="w-6 h-6" />
            </div>
          </div>
          <h3 className="text-orange-100 text-sm font-medium mb-1">Total Receivable</h3>
          <p className="text-3xl font-bold">{formatINR(totalReceivable)}</p>
          <p className="text-xs mt-2 opacity-90">{filteredInvoices.length} pending invoices</p>
        </div>

        <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-xl shadow-lg p-6 text-white">
          <div className="flex items-center justify-between mb-4">
            <div className="bg-white bg-opacity-20 p-3 rounded-lg">
              <AlertCircle className="w-6 h-6" />
            </div>
          </div>
          <h3 className="text-red-100 text-sm font-medium mb-1">Overdue Amount</h3>
          <p className="text-3xl font-bold">{formatINR(totalOverdue)}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between mb-6">
          <div className="flex flex-col sm:flex-row gap-3 flex-1 w-full">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search by invoice or customer..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              />
            </div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
              className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            >
              <option value="all">All Status</option>
              <option value="unpaid">Unpaid</option>
              <option value="partial">Partial Payment</option>
              <option value="overdue">Overdue</option>
            </select>
          </div>
        </div>

        {filteredInvoices.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <CheckCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No pending receivables</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">Invoice</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">Customer</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">Due Date</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-slate-600 uppercase tracking-wider">Total</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-slate-600 uppercase tracking-wider">Paid</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-slate-600 uppercase tracking-wider">Opening Balance</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-slate-600 uppercase tracking-wider">Balance</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-slate-600 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-slate-600 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredInvoices.map((invoice) => {
                  const balance = invoice.total - invoice.amount_paid;
                  const isOverdue = new Date(invoice.due_date) < new Date();

                  return (
                    <tr key={invoice.id} className={`hover:bg-slate-50 transition ${isOverdue ? 'bg-red-50' : ''}`}>
                      <td className="px-4 py-3 text-sm font-medium text-slate-900">
                        {invoice.invoice_number}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-900">
                        <div>
                          <div className="font-medium">{invoice.customer?.name}</div>
                          <div className="text-xs text-slate-500">{invoice.customer?.phone}</div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-900">
                        {new Date(invoice.due_date).toLocaleDateString('en-IN')}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-900 text-right">
                        {formatINR(invoice.total)}
                      </td>
                      <td className="px-4 py-3 text-sm text-green-600 text-right">
                        {formatINR(invoice.amount_paid)}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-900 text-right">
                        {formatINR(invoice.customer?.opening_balance || 0)}
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold text-orange-600 text-right">
                        {formatINR(balance + (invoice.customer?.opening_balance || 0))}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {getStatusBadge(invoice)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => {
                            setSelectedInvoice(invoice);
                            setFormData({
                              amount: balance.toString(),
                              payment_date: new Date().toISOString().split('T')[0],
                              payment_method_id: '',
                              reference_number: '',
                              notes: '',
                            });
                            setShowModal(true);
                          }}
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition"
                        >
                          Add Payment
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Transaction Activity</h3>
        {transactions.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            <p>No transactions found</p>
          </div>
        ) : (
          <div className="space-y-3">
            {transactions.map((transaction) => (
              <div key={transaction.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                <div className="flex-1">
                  <div className="font-medium text-slate-900">{transaction.category}</div>
                  <div className="text-sm text-slate-600">{transaction.description}</div>
                  <div className="text-xs text-slate-500">
                    {new Date(transaction.transaction_date).toLocaleDateString('en-IN')}
                  </div>
                </div>
                <div className="text-right">
                  <div className={`font-semibold ${transaction.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                    {transaction.type === 'income' ? '+' : '-'}{formatINR(transaction.amount)}
                  </div>
                  {transaction.payment_method && (
                    <div className="text-xs text-slate-500">{transaction.payment_method.name}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && selectedInvoice && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full">
            <div className="p-6 border-b border-slate-200">
              <h2 className="text-2xl font-bold text-slate-900">Record Payment</h2>
              <div className="mt-2 text-sm text-slate-600">
                <p>Invoice: <span className="font-medium">{selectedInvoice.invoice_number}</span></p>
                <p>Customer: <span className="font-medium">{selectedInvoice.customer?.name}</span></p>
                <p className="mt-2">
                  Total: <span className="font-semibold">{formatINR(selectedInvoice.total)}</span> |
                  Paid: <span className="font-semibold text-green-600">{formatINR(selectedInvoice.amount_paid)}</span> |
                  Balance: <span className="font-semibold text-orange-600">{formatINR(selectedInvoice.total - selectedInvoice.amount_paid)}</span>
                </p>
              </div>
            </div>
            <form onSubmit={handleAddPayment} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Payment Amount *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    required
                    max={selectedInvoice.total - selectedInvoice.amount_paid}
                    placeholder="0.00"
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Payment Date *</label>
                  <input
                    type="date"
                    value={formData.payment_date}
                    onChange={(e) => setFormData({ ...formData, payment_date: e.target.value })}
                    required
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Payment Method</label>
                  <select
                    value={formData.payment_method_id}
                    onChange={(e) => setFormData({ ...formData, payment_method_id: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  >
                    <option value="">Select Method</option>
                    {paymentMethods.map((method) => (
                      <option key={method.id} value={method.id}>{method.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Reference Number</label>
                  <input
                    type="text"
                    value={formData.reference_number}
                    onChange={(e) => setFormData({ ...formData, reference_number: e.target.value })}
                    placeholder="Transaction ID, Cheque No, etc."
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                  placeholder="Additional payment notes..."
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition"
                >
                  Record Payment
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setSelectedInvoice(null);
                  }}
                  className="flex-1 px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-medium rounded-lg transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
