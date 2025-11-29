import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Plus, Search, Trash2, Receipt, Clock, CheckCircle, AlertCircle, IndianRupee, ChevronDown, ChevronRight, Printer } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { formatINR } from '../../lib/currency';
import { calculateItemGST } from '../../lib/gst';

interface Supplier {
  id: string;
  name: string;
}

interface Purchase {
  id: string;
  purchase_number: string;
  supplier_id: string;
  status: string;
  payment_status: string;
  amount_paid: number;
  total: number;
  order_date: string;
  expected_date: string | null;
  received_date: string | null;
  created_at: string;
  supplier?: { name: string };
}

interface PurchaseItem {
  temp_id?: string;
  product_name: string;
  sku: string;
  quantity: number;
  unit: string;
  unit_price: number;
  gst_rate: number;
  hsn_code: string;
}

interface PaymentMethod {
  id: string;
  name: string;
}

export function Purchases() {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState<'orders' | 'payables'>('orders');
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week' | 'month' | 'year'>('all');
  const [showModal, setShowModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedPurchase, setSelectedPurchase] = useState<Purchase | null>(null);
  const [companyState, setCompanyState] = useState<string>('');
  const [selectedItems, setSelectedItems] = useState<PurchaseItem[]>([]);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [formData, setFormData] = useState({
    supplier_id: '',
    order_date: new Date().toISOString().split('T')[0],
    expected_date: '',
    notes: '',
  });
  const [newItemForm, setNewItemForm] = useState({
    product_name: '',
    sku: '',
    quantity: '',
    unit: 'piece',
    unit_price: '',
    gst_rate: '18',
    hsn_code: '',
  });
  const [paymentFormData, setPaymentFormData] = useState({
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
      const [purchasesData, suppliersData, methodsData, companyData] = await Promise.all([
        supabase
          .from('purchases')
          .select(`
            *,
            supplier:suppliers(name),
            items:purchase_items(*)
          `)
          .order('created_at', { ascending: false }),
        supabase
          .from('suppliers')
          .select('id, name')
          .order('name'),
        supabase
          .from('payment_methods')
          .select('*')
          .eq('is_active', true)
          .order('name'),
        supabase
          .from('company_profile')
          .select('state')
          .eq('user_id', profile?.id)
          .single(),
      ]);

      if (purchasesData.error) throw purchasesData.error;
      if (suppliersData.error) throw suppliersData.error;
      if (methodsData.error) throw methodsData.error;

      setPurchases(purchasesData.data || []);
      setSuppliers(suppliersData.data || []);
      setPaymentMethods(methodsData.data || []);
      setCompanyState(companyData.data?.state || '');
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const generatePurchaseNumber = async () => {
    const { data, error } = await supabase
      .from('purchases')
      .select('purchase_number')
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) throw error;

    const lastNumber = data && data.length > 0
      ? parseInt(data[0].purchase_number.replace('PO-', ''))
      : 0;

    return `PO-${String(lastNumber + 1).padStart(5, '0')}`;
  };

  const handleAddItem = () => {
    if (!newItemForm.product_name || !newItemForm.sku || !newItemForm.quantity || !newItemForm.unit_price) {
      alert('Please fill in all required fields');
      return;
    }

    const newItem: PurchaseItem = {
      temp_id: Date.now().toString(),
      product_name: newItemForm.product_name,
      sku: newItemForm.sku,
      quantity: parseFloat(newItemForm.quantity),
      unit: newItemForm.unit,
      unit_price: parseFloat(newItemForm.unit_price),
      gst_rate: parseFloat(newItemForm.gst_rate),
      hsn_code: newItemForm.hsn_code,
    };

    setSelectedItems([...selectedItems, newItem]);
    setNewItemForm({
      product_name: '',
      sku: '',
      quantity: '',
      unit: 'piece',
      unit_price: '',
      gst_rate: '18',
      hsn_code: '',
    });
  };

  const handleRemoveItem = (tempId: string) => {
    setSelectedItems(selectedItems.filter(item => item.temp_id !== tempId));
  };

  const handleUpdateQuantity = (tempId: string, quantity: number) => {
    setSelectedItems(selectedItems.map(item =>
      item.temp_id === tempId ? { ...item, quantity } : item
    ));
  };

  const handleUpdatePrice = (tempId: string, unit_price: number) => {
    setSelectedItems(selectedItems.map(item =>
      item.temp_id === tempId ? { ...item, unit_price } : item
    ));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (selectedItems.length === 0) {
      alert('Please add at least one item');
      return;
    }

    try {
      const purchaseNumber = await generatePurchaseNumber();

      const { data: supplierData } = await supabase
        .from('suppliers')
        .select('state')
        .eq('id', formData.supplier_id)
        .maybeSingle();

      const supplierState = (supplierData?.state || '').trim();
      const cleanCompanyState = (companyState || '').trim();
      const isInterstate = cleanCompanyState && supplierState ? cleanCompanyState !== supplierState : false;

      console.log('Purchase creation debug:', {
        companyState: cleanCompanyState,
        supplierState,
        isInterstate,
        isInterstateType: typeof isInterstate,
        rawSupplierState: supplierData?.state,
        rawCompanyState: companyState
      });

      let subtotal = 0;
      let totalCGST = 0;
      let totalSGST = 0;
      let totalIGST = 0;

      const productsToCreate = [];
      const itemsWithTax = [];

      for (const item of selectedItems) {
        const { data: existingProduct } = await supabase
          .from('products')
          .select('id')
          .eq('sku', item.sku)
          .single();

        let productId = existingProduct?.id;

        if (!productId) {
          const { data: newProduct, error: productError } = await supabase
            .from('products')
            .insert([{
              name: item.product_name,
              sku: item.sku,
              description: 'Raw Material',
              cost_price: item.unit_price,
              selling_price: item.unit_price,
              quantity: 0,
              reorder_level: 10,
              unit: item.unit,
              hsn_code: item.hsn_code || '',
              gst_rate: item.gst_rate,
              inventory_type: 'raw_material',
              created_by: profile?.id,
            }])
            .select()
            .single();

          if (productError) throw productError;
          productId = newProduct.id;
        }

        const itemSubtotal = item.quantity * item.unit_price;
        const gstCalculation = calculateItemGST(itemSubtotal, item.gst_rate, isInterstate);

        subtotal += itemSubtotal;
        totalCGST += gstCalculation.cgst;
        totalSGST += gstCalculation.sgst;
        totalIGST += gstCalculation.igst;

        itemsWithTax.push({
          product_id: productId,
          quantity: item.quantity,
          unit_price: item.unit_price,
          cgst_rate: gstCalculation.cgstRate,
          sgst_rate: gstCalculation.sgstRate,
          igst_rate: gstCalculation.igstRate,
          cgst_amount: gstCalculation.cgst,
          sgst_amount: gstCalculation.sgst,
          igst_amount: gstCalculation.igst,
          total: itemSubtotal + gstCalculation.cgst + gstCalculation.sgst + gstCalculation.igst,
        });
      }

      const totalTax = totalCGST + totalSGST + totalIGST;
      const total = subtotal + totalTax;

      const purchaseData = {
        purchase_number: purchaseNumber,
        supplier_id: formData.supplier_id,
        status: 'ordered',
        payment_status: 'unpaid',
        amount_paid: 0,
        subtotal,
        cgst: totalCGST,
        sgst: totalSGST,
        igst: totalIGST,
        tax: totalTax,
        total,
        is_interstate: Boolean(isInterstate),
        place_of_supply: supplierState || null,
        order_date: formData.order_date,
        expected_date: formData.expected_date || null,
        notes: formData.notes || null,
        created_by: profile?.id,
      };

      console.log('Purchase data being inserted:', purchaseData);
      console.log('is_interstate value:', purchaseData.is_interstate, 'type:', typeof purchaseData.is_interstate);

      const { data: purchase, error: purchaseError } = await supabase
        .from('purchases')
        .insert([purchaseData])
        .select()
        .single();

      if (purchaseError) throw purchaseError;

      const itemsToInsert = itemsWithTax.map(item => ({
        ...item,
        purchase_id: purchase.id,
      }));

      const { error: itemsError } = await supabase
        .from('purchase_items')
        .insert(itemsToInsert);

      if (itemsError) throw itemsError;

      setShowModal(false);
      setFormData({
        supplier_id: '',
        order_date: new Date().toISOString().split('T')[0],
        expected_date: '',
        notes: '',
      });
      setSelectedItems([]);
      loadData();
    } catch (error) {
      console.error('Error creating purchase:', error);
      alert('Error creating purchase: ' + (error as Error).message);
    }
  };

  const handleMarkReceived = async (id: string) => {
    if (!confirm('Mark this purchase as received? This will update inventory.')) return;

    try {
      const { data: purchaseItems, error: itemsError } = await supabase
        .from('purchase_items')
        .select('product_id, quantity')
        .eq('purchase_id', id);

      if (itemsError) throw itemsError;

      for (const item of purchaseItems || []) {
        const { data: product } = await supabase
          .from('products')
          .select('quantity')
          .eq('id', item.product_id)
          .single();

        if (product) {
          const newQuantity = product.quantity + item.quantity;

          await supabase
            .from('products')
            .update({ quantity: newQuantity })
            .eq('id', item.product_id);

          const purchase = purchases.find(p => p.id === id);

          await supabase
            .from('inventory_movements')
            .insert([{
              product_id: item.product_id,
              type: 'in',
              quantity: item.quantity,
              reason: `Purchase ${purchase?.purchase_number} received`,
              created_by: profile?.id,
            }]);
        }
      }

      const { error } = await supabase
        .from('purchases')
        .update({
          status: 'received',
          received_date: new Date().toISOString().split('T')[0],
        })
        .eq('id', id);

      if (error) throw error;
      loadData();
    } catch (error) {
      console.error('Error marking received:', error);
      alert('Error marking received: ' + (error as Error).message);
    }
  };

  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPurchase) return;

    try {
      const paymentAmount = parseFloat(paymentFormData.amount);
      const remainingAmount = selectedPurchase.total - selectedPurchase.amount_paid;

      if (paymentAmount <= 0) {
        alert('Payment amount must be greater than 0');
        return;
      }

      if (paymentAmount > remainingAmount) {
        alert(`Payment amount cannot exceed remaining balance of ${formatINR(remainingAmount)}`);
        return;
      }

      const { error: paymentError } = await supabase
        .from('purchase_payments')
        .insert([{
          purchase_id: selectedPurchase.id,
          amount: paymentAmount,
          payment_date: paymentFormData.payment_date,
          payment_method_id: paymentFormData.payment_method_id || null,
          reference_number: paymentFormData.reference_number || null,
          notes: paymentFormData.notes || null,
          created_by: profile?.id,
        }]);

      if (paymentError) throw paymentError;

      const newAmountPaid = selectedPurchase.amount_paid + paymentAmount;
      const newPaymentStatus = newAmountPaid >= selectedPurchase.total ? 'paid' : newAmountPaid > 0 ? 'partial' : 'unpaid';

      const { error: purchaseError } = await supabase
        .from('purchases')
        .update({
          amount_paid: newAmountPaid,
          payment_status: newPaymentStatus,
        })
        .eq('id', selectedPurchase.id);

      if (purchaseError) throw purchaseError;

      const { error: transactionError } = await supabase
        .from('transactions')
        .insert([{
          type: 'expense',
          category: 'Inventory Purchase',
          amount: paymentAmount,
          description: `Payment for Purchase ${selectedPurchase.purchase_number}`,
          transaction_date: paymentFormData.payment_date,
          payment_method_id: paymentFormData.payment_method_id || null,
          reference_number: paymentFormData.reference_number || null,
          created_by: profile?.id,
        }]);

      if (transactionError) throw transactionError;

      setShowPaymentModal(false);
      setSelectedPurchase(null);
      setPaymentFormData({
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

  const toggleRow = (purchaseId: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(purchaseId)) {
      newExpanded.delete(purchaseId);
    } else {
      newExpanded.add(purchaseId);
    }
    setExpandedRows(newExpanded);
  };

  const handlePrintPO = (purchase: any) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const items = purchase.items || [];
    const supplier = purchase.supplier;

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Purchase Order - ${purchase.purchase_number}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            h1 { text-align: center; margin-bottom: 20px; }
            .header { margin-bottom: 30px; }
            .info-section { margin-bottom: 20px; }
            .info-label { font-weight: bold; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #000; padding: 8px; text-align: left; }
            th { background-color: #f0f0f0; }
            .text-right { text-align: right; }
            .text-center { text-align: center; }
            .total-row { font-weight: bold; background-color: #f9f9f9; }
            @media print {
              button { display: none; }
            }
          </style>
        </head>
        <body>
          <button onclick="window.print()" style="padding: 10px 20px; margin-bottom: 20px; cursor: pointer;">Print</button>

          <h1>PURCHASE ORDER</h1>

          <div class="header">
            <div class="info-section">
              <div><span class="info-label">PO Number:</span> ${purchase.purchase_number}</div>
              <div><span class="info-label">Order Date:</span> ${new Date(purchase.order_date).toLocaleDateString('en-IN')}</div>
              ${purchase.expected_date ? `<div><span class="info-label">Expected Date:</span> ${new Date(purchase.expected_date).toLocaleDateString('en-IN')}</div>` : ''}
            </div>

            <div class="info-section">
              <div><span class="info-label">Supplier:</span> ${supplier?.name || 'N/A'}</div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Sr. No.</th>
                <th>Product Name</th>
                <th>SKU</th>
                <th class="text-center">Quantity</th>
                <th class="text-right">Unit Price</th>
                <th class="text-center">GST %</th>
                <th class="text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              ${items.map((item: any, index: number) => `
                <tr>
                  <td class="text-center">${index + 1}</td>
                  <td>${item.product_name}</td>
                  <td>${item.sku}</td>
                  <td class="text-center">${item.quantity} ${item.unit}</td>
                  <td class="text-right">${formatINR(item.unit_price)}</td>
                  <td class="text-center">${item.gst_rate}%</td>
                  <td class="text-right">${formatINR(item.total)}</td>
                </tr>
              `).join('')}
              <tr class="total-row">
                <td colspan="6" class="text-right">Subtotal:</td>
                <td class="text-right">${formatINR(purchase.subtotal)}</td>
              </tr>
              ${purchase.cgst > 0 ? `
                <tr>
                  <td colspan="6" class="text-right">CGST:</td>
                  <td class="text-right">${formatINR(purchase.cgst)}</td>
                </tr>
                <tr>
                  <td colspan="6" class="text-right">SGST:</td>
                  <td class="text-right">${formatINR(purchase.sgst)}</td>
                </tr>
              ` : ''}
              ${purchase.igst > 0 ? `
                <tr>
                  <td colspan="6" class="text-right">IGST:</td>
                  <td class="text-right">${formatINR(purchase.igst)}</td>
                </tr>
              ` : ''}
              <tr class="total-row">
                <td colspan="6" class="text-right">Grand Total:</td>
                <td class="text-right">${formatINR(purchase.total)}</td>
              </tr>
            </tbody>
          </table>

          ${purchase.notes ? `
            <div style="margin-top: 30px;">
              <div class="info-label">Notes:</div>
              <div>${purchase.notes}</div>
            </div>
          ` : ''}
        </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this purchase?')) return;

    try {
      const { error } = await supabase
        .from('purchases')
        .delete()
        .eq('id', id);

      if (error) throw error;
      loadData();
    } catch (error) {
      console.error('Error deleting purchase:', error);
      alert('Error deleting purchase: ' + (error as Error).message);
    }
  };

  const getStatusBadge = (purchase: Purchase) => {
    switch (purchase.status) {
      case 'ordered':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
            <Clock className="w-3 h-3" />
            Ordered
          </span>
        );
      case 'received':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
            <CheckCircle className="w-3 h-3" />
            Received
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
            <AlertCircle className="w-3 h-3" />
            Cancelled
          </span>
        );
      default:
        return null;
    }
  };

  const getPaymentStatusBadge = (purchase: Purchase) => {
    switch (purchase.payment_status) {
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

  const filteredPurchases = purchases.filter(purchase => {
    const matchesSearch =
      purchase.purchase_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      purchase.supplier?.name.toLowerCase().includes(searchTerm.toLowerCase());

    let matchesDate = true;
    if (dateFilter !== 'all') {
      const purchaseDate = new Date(purchase.order_date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      switch (dateFilter) {
        case 'today':
          const todayEnd = new Date(today);
          todayEnd.setHours(23, 59, 59, 999);
          matchesDate = purchaseDate >= today && purchaseDate <= todayEnd;
          break;
        case 'week':
          const weekAgo = new Date(today);
          weekAgo.setDate(today.getDate() - 7);
          matchesDate = purchaseDate >= weekAgo;
          break;
        case 'month':
          const monthAgo = new Date(today);
          monthAgo.setMonth(today.getMonth() - 1);
          matchesDate = purchaseDate >= monthAgo;
          break;
        case 'year':
          const yearAgo = new Date(today);
          yearAgo.setFullYear(today.getFullYear() - 1);
          matchesDate = purchaseDate >= yearAgo;
          break;
      }
    }

    if (activeTab === 'payables') {
      return matchesSearch && matchesDate && purchase.payment_status !== 'paid';
    }

    return matchesSearch && matchesDate;
  });

  const totalPayable = purchases
    .filter(p => p.payment_status !== 'paid')
    .reduce((sum, p) => sum + (p.total - p.amount_paid), 0);

  if (loading) {
    return <div className="text-center py-8">Loading purchases...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Purchase Management</h1>
          <p className="text-slate-600 mt-1">Manage purchase orders and supplier payments</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition flex items-center gap-2 shadow-sm"
        >
          <Plus className="w-5 h-5" />
          New Purchase Order
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        <div className="border-b border-slate-200">
          <div className="flex">
            <button
              onClick={() => setActiveTab('orders')}
              className={`flex-1 px-6 py-4 text-sm font-medium transition ${
                activeTab === 'orders'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <Receipt className="w-5 h-5" />
                Purchase Orders
              </div>
            </button>
            <button
              onClick={() => setActiveTab('payables')}
              className={`flex-1 px-6 py-4 text-sm font-medium transition ${
                activeTab === 'payables'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <IndianRupee className="w-5 h-5" />
                Payment Payables
                {totalPayable > 0 && (
                  <span className="ml-2 px-2 py-0.5 bg-orange-100 text-orange-700 text-xs font-semibold rounded-full">
                    {formatINR(totalPayable)}
                  </span>
                )}
              </div>
            </button>
          </div>
        </div>

        <div className="p-6">
          <div className="mb-6 flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
              <input
                type="text"
                placeholder={`Search ${activeTab === 'orders' ? 'purchase orders' : 'payables'}...`}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              />
            </div>
            <div className="sm:w-48">
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value as any)}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white"
              >
                <option value="all">All Time</option>
                <option value="today">Today</option>
                <option value="week">Last 7 Days</option>
                <option value="month">Last Month</option>
                <option value="year">Last Year</option>
              </select>
            </div>
          </div>

          {filteredPurchases.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <Receipt className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No {activeTab === 'orders' ? 'purchase orders' : 'payables'} found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                      Purchase #
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                      Supplier
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-600 uppercase tracking-wider">
                      Total
                    </th>
                    {activeTab === 'payables' && (
                      <>
                        <th className="px-4 py-3 text-right text-xs font-medium text-slate-600 uppercase tracking-wider">
                          Paid
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-slate-600 uppercase tracking-wider">
                          Balance
                        </th>
                      </>
                    )}
                    <th className="px-4 py-3 text-center text-xs font-medium text-slate-600 uppercase tracking-wider">
                      Status
                    </th>
                    {activeTab === 'payables' && (
                      <th className="px-4 py-3 text-center text-xs font-medium text-slate-600 uppercase tracking-wider">
                        Payment
                      </th>
                    )}
                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-600 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredPurchases.map((purchase) => {
                    const balance = purchase.total - purchase.amount_paid;
                    const isExpanded = expandedRows.has(purchase.id);

                    return (
                      <>
                        <tr key={purchase.id} className="hover:bg-slate-50 transition">
                          <td className="px-4 py-3 text-sm font-medium text-slate-900">
                            <button
                              onClick={() => toggleRow(purchase.id)}
                              className="flex items-center gap-2 hover:text-blue-600 transition"
                            >
                              {isExpanded ? (
                                <ChevronDown className="w-4 h-4" />
                              ) : (
                                <ChevronRight className="w-4 h-4" />
                              )}
                              {purchase.purchase_number}
                            </button>
                          </td>
                        <td className="px-4 py-3 text-sm text-slate-900">
                          {purchase.supplier?.name}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-900">
                          {new Date(purchase.order_date).toLocaleDateString('en-IN')}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-900 text-right">
                          {formatINR(purchase.total)}
                        </td>
                        {activeTab === 'payables' && (
                          <>
                            <td className="px-4 py-3 text-sm text-green-600 text-right">
                              {formatINR(purchase.amount_paid)}
                            </td>
                            <td className="px-4 py-3 text-sm font-semibold text-orange-600 text-right">
                              {formatINR(balance)}
                            </td>
                          </>
                        )}
                        <td className="px-4 py-3 text-center">
                          <div className="flex flex-col gap-1 items-center">
                            {getStatusBadge(purchase)}
                            {activeTab === 'orders' && getPaymentStatusBadge(purchase)}
                          </div>
                        </td>
                        {activeTab === 'payables' && (
                          <td className="px-4 py-3 text-center">
                            {getPaymentStatusBadge(purchase)}
                          </td>
                        )}
                        <td className="px-4 py-3 text-right">
                          <div className="flex gap-2 justify-end">
                            <button
                              onClick={() => handlePrintPO(purchase)}
                              className="p-2 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                              title="Print PO"
                            >
                              <Printer className="w-4 h-4" />
                            </button>
                            {activeTab === 'payables' && (
                              <button
                                onClick={() => {
                                  setSelectedPurchase(purchase);
                                  setPaymentFormData({
                                    amount: balance.toString(),
                                    payment_date: new Date().toISOString().split('T')[0],
                                    payment_method_id: '',
                                    reference_number: '',
                                    notes: '',
                                  });
                                  setShowPaymentModal(true);
                                }}
                                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition"
                              >
                                Add Payment
                              </button>
                            )}
                            {purchase.status === 'ordered' && activeTab === 'orders' && (
                              <button
                                onClick={() => handleMarkReceived(purchase.id)}
                                className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition"
                              >
                                Mark Received
                              </button>
                            )}
                            <button
                              onClick={() => handleDelete(purchase.id)}
                              className="p-2 text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                      {isExpanded && (purchase as any).items && (
                        <tr>
                          <td colSpan={activeTab === 'payables' ? 8 : 6} className="px-4 py-0 bg-slate-50">
                            <div className="py-3">
                              <h4 className="text-sm font-semibold text-slate-700 mb-2">Purchase Items</h4>
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="border-b border-slate-300">
                                    <th className="text-left py-2 px-2 text-xs font-medium text-slate-600">Product</th>
                                    <th className="text-center py-2 px-2 text-xs font-medium text-slate-600">SKU</th>
                                    <th className="text-center py-2 px-2 text-xs font-medium text-slate-600">Quantity</th>
                                    <th className="text-right py-2 px-2 text-xs font-medium text-slate-600">Unit Price</th>
                                    <th className="text-center py-2 px-2 text-xs font-medium text-slate-600">GST</th>
                                    <th className="text-right py-2 px-2 text-xs font-medium text-slate-600">Total</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {((purchase as any).items || []).map((item: any, idx: number) => (
                                    <tr key={idx} className="border-b border-slate-200">
                                      <td className="py-2 px-2 text-slate-900">{item.product_name}</td>
                                      <td className="py-2 px-2 text-center text-slate-600">{item.sku}</td>
                                      <td className="py-2 px-2 text-center text-slate-900">
                                        {item.quantity} {item.unit}
                                      </td>
                                      <td className="py-2 px-2 text-right text-slate-900">{formatINR(item.unit_price)}</td>
                                      <td className="py-2 px-2 text-center text-slate-600">{item.gst_rate}%</td>
                                      <td className="py-2 px-2 text-right font-medium text-slate-900">
                                        {formatINR(item.total)}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                      </>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl max-w-6xl w-full my-8">
            <div className="p-6 border-b border-slate-200">
              <h2 className="text-2xl font-bold text-slate-900">Create Purchase Order</h2>
              <p className="text-sm text-slate-600 mt-1">Add raw materials manually to this purchase order</p>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Supplier *
                  </label>
                  <select
                    value={formData.supplier_id}
                    onChange={(e) => setFormData({ ...formData, supplier_id: e.target.value })}
                    required
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  >
                    <option value="">Select Supplier</option>
                    {suppliers.map((supplier) => (
                      <option key={supplier.id} value={supplier.id}>
                        {supplier.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Order Date *
                  </label>
                  <input
                    type="date"
                    value={formData.order_date}
                    onChange={(e) => setFormData({ ...formData, order_date: e.target.value })}
                    required
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Expected Date
                  </label>
                  <input
                    type="date"
                    value={formData.expected_date}
                    onChange={(e) => setFormData({ ...formData, expected_date: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  />
                </div>
              </div>

              <div className="border-t border-slate-200 pt-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Add Raw Material</h3>
                <div className="bg-slate-50 p-4 rounded-lg space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Product Name *</label>
                      <input
                        type="text"
                        value={newItemForm.product_name}
                        onChange={(e) => setNewItemForm({ ...newItemForm, product_name: e.target.value })}
                        placeholder="e.g., Cotton Fabric"
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">SKU *</label>
                      <input
                        type="text"
                        value={newItemForm.sku}
                        onChange={(e) => setNewItemForm({ ...newItemForm, sku: e.target.value })}
                        placeholder="e.g., FAB001"
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">HSN Code</label>
                      <input
                        type="text"
                        value={newItemForm.hsn_code}
                        onChange={(e) => setNewItemForm({ ...newItemForm, hsn_code: e.target.value })}
                        placeholder="e.g., 5208"
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Quantity *</label>
                      <input
                        type="number"
                        step="0.01"
                        value={newItemForm.quantity}
                        onChange={(e) => setNewItemForm({ ...newItemForm, quantity: e.target.value })}
                        placeholder="e.g., 100"
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Unit *</label>
                      <select
                        value={newItemForm.unit}
                        onChange={(e) => setNewItemForm({ ...newItemForm, unit: e.target.value })}
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                      >
                        <option value="piece">Piece</option>
                        <option value="kg">Kilogram (kg)</option>
                        <option value="gram">Gram (g)</option>
                        <option value="meter">Meter (m)</option>
                        <option value="centimeter">Centimeter (cm)</option>
                        <option value="liter">Liter (L)</option>
                        <option value="milliliter">Milliliter (ml)</option>
                        <option value="box">Box</option>
                        <option value="packet">Packet</option>
                        <option value="dozen">Dozen</option>
                        <option value="set">Set</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Unit Price *</label>
                      <input
                        type="number"
                        step="0.01"
                        value={newItemForm.unit_price}
                        onChange={(e) => setNewItemForm({ ...newItemForm, unit_price: e.target.value })}
                        placeholder="e.g., 50.00"
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">GST Rate (%)</label>
                      <select
                        value={newItemForm.gst_rate}
                        onChange={(e) => setNewItemForm({ ...newItemForm, gst_rate: e.target.value })}
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                      >
                        <option value="0">0%</option>
                        <option value="5">5%</option>
                        <option value="12">12%</option>
                        <option value="18">18%</option>
                        <option value="28">28%</option>
                      </select>
                    </div>

                    <div className="flex items-end">
                      <button
                        type="button"
                        onClick={handleAddItem}
                        className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition flex items-center justify-center gap-2"
                      >
                        <Plus className="w-5 h-5" />
                        Add Item
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {selectedItems.length > 0 && (
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <div className="bg-slate-100 px-4 py-2 border-b border-slate-200">
                    <h4 className="font-semibold text-slate-900">Purchase Items ({selectedItems.length})</h4>
                  </div>
                  <table className="w-full">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-slate-600">Product</th>
                        <th className="px-4 py-2 text-center text-xs font-medium text-slate-600">Quantity</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-slate-600">Unit Price</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-slate-600">GST</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-slate-600">Total</th>
                        <th className="px-4 py-2"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {selectedItems.map((item) => {
                        const subtotal = item.quantity * item.unit_price;
                        const total = subtotal + (subtotal * item.gst_rate / 100);
                        return (
                          <tr key={item.temp_id}>
                            <td className="px-4 py-2 text-sm">
                              <div className="font-medium">{item.product_name}</div>
                              <div className="text-xs text-slate-500">{item.sku} - {item.unit}</div>
                            </td>
                            <td className="px-4 py-2">
                              <div className="flex items-center gap-2 justify-center">
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0.01"
                                  value={item.quantity}
                                  onChange={(e) => handleUpdateQuantity(item.temp_id!, parseFloat(e.target.value))}
                                  className="w-20 px-2 py-1 border border-slate-300 rounded text-center"
                                />
                                <span className="text-xs text-slate-500">{item.unit}</span>
                              </div>
                            </td>
                            <td className="px-4 py-2">
                              <div className="flex items-center gap-1 justify-end">
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={item.unit_price}
                                  onChange={(e) => handleUpdatePrice(item.temp_id!, parseFloat(e.target.value))}
                                  className="w-24 px-2 py-1 border border-slate-300 rounded text-right"
                                />
                                <span className="text-xs text-slate-500">/{item.unit}</span>
                              </div>
                            </td>
                            <td className="px-4 py-2 text-sm text-right text-slate-600">
                              {item.gst_rate}%
                            </td>
                            <td className="px-4 py-2 text-sm text-right font-medium">
                              {formatINR(total)}
                            </td>
                            <td className="px-4 py-2">
                              <button
                                type="button"
                                onClick={() => handleRemoveItem(item.temp_id!)}
                                className="text-red-600 hover:text-red-700"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                  placeholder="Additional notes about this purchase..."
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  disabled={selectedItems.length === 0}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition disabled:bg-slate-300 disabled:cursor-not-allowed"
                >
                  Create Purchase Order
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setSelectedItems([]);
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

      {showPaymentModal && selectedPurchase && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full">
            <div className="p-6 border-b border-slate-200">
              <h2 className="text-2xl font-bold text-slate-900">Record Payment</h2>
              <div className="mt-2 text-sm text-slate-600">
                <p>Purchase Order: <span className="font-medium">{selectedPurchase.purchase_number}</span></p>
                <p>Supplier: <span className="font-medium">{selectedPurchase.supplier?.name}</span></p>
                <p className="mt-2">
                  Total: <span className="font-semibold">{formatINR(selectedPurchase.total)}</span> |
                  Paid: <span className="font-semibold text-green-600">{formatINR(selectedPurchase.amount_paid)}</span> |
                  Balance: <span className="font-semibold text-orange-600">{formatINR(selectedPurchase.total - selectedPurchase.amount_paid)}</span>
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
                    value={paymentFormData.amount}
                    onChange={(e) => setPaymentFormData({ ...paymentFormData, amount: e.target.value })}
                    required
                    max={selectedPurchase.total - selectedPurchase.amount_paid}
                    placeholder="0.00"
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Payment Date *</label>
                  <input
                    type="date"
                    value={paymentFormData.payment_date}
                    onChange={(e) => setPaymentFormData({ ...paymentFormData, payment_date: e.target.value })}
                    required
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Payment Method</label>
                  <select
                    value={paymentFormData.payment_method_id}
                    onChange={(e) => setPaymentFormData({ ...paymentFormData, payment_method_id: e.target.value })}
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
                    value={paymentFormData.reference_number}
                    onChange={(e) => setPaymentFormData({ ...paymentFormData, reference_number: e.target.value })}
                    placeholder="Transaction ID, Cheque No, etc."
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Notes</label>
                <textarea
                  value={paymentFormData.notes}
                  onChange={(e) => setPaymentFormData({ ...paymentFormData, notes: e.target.value })}
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
                    setShowPaymentModal(false);
                    setSelectedPurchase(null);
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
