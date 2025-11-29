import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Plus, Trash2, Eye, Receipt, Printer, Edit2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { formatINR } from '../../lib/currency';

interface MenuItem {
  id: string;
  name: string;
  price: number;
}

interface BillItem {
  menu_item_id: string;
  menu_item_name?: string;
  quantity: number;
  unit_price: number;
}

interface Bill {
  id: string;
  bill_number: string;
  bill_date: string;
  customer_name: string;
  customer_phone: string;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  payment_status: string;
  payment_method: string;
  notes: string;
}

export function Billing() {
  const { user } = useAuth();
  const [bills, setBills] = useState<Bill[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingBill, setEditingBill] = useState<Bill | null>(null);
  const [selectedItems, setSelectedItems] = useState<BillItem[]>([]);
  const [formData, setFormData] = useState({
    customer_name: '',
    customer_phone: '',
    payment_method: 'cash',
    custom_payment_method: '',
    payment_status: 'paid',
    notes: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [billsRes, menuItemsRes] = await Promise.all([
        supabase
          .from('bills')
          .select('*')
          .order('created_at', { ascending: false }),
        supabase
          .from('menu_items')
          .select('*')
          .eq('is_active', true)
          .eq('is_available', true)
          .order('name'),
      ]);

      if (billsRes.error) throw billsRes.error;
      if (menuItemsRes.error) throw menuItemsRes.error;

      setBills(billsRes.data || []);
      setMenuItems(menuItemsRes.data || []);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateBillNumber = () => {
    const date = new Date();
    const timestamp = date.getTime().toString().slice(-6);
    return `BILL-${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}-${timestamp}`;
  };

  const addItem = () => {
    if (menuItems.length === 0) {
      alert('Please add menu items first');
      return;
    }
    setSelectedItems([
      ...selectedItems,
      { menu_item_id: menuItems[0].id, quantity: 1, unit_price: menuItems[0].price },
    ]);
  };

  const removeItem = (index: number) => {
    setSelectedItems(selectedItems.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: string, value: any) => {
    const newItems = [...selectedItems];
    if (field === 'menu_item_id') {
      const menuItem = menuItems.find((m) => m.id === value);
      if (menuItem) {
        newItems[index] = {
          ...newItems[index],
          menu_item_id: value,
          unit_price: menuItem.price,
        };
      }
    } else {
      newItems[index] = { ...newItems[index], [field]: value };
    }
    setSelectedItems(newItems);
  };

  const calculateTotals = () => {
    const subtotal = selectedItems.reduce(
      (sum, item) => sum + item.quantity * item.unit_price,
      0
    );
    const taxAmount = subtotal * 0.05;
    const total = subtotal + taxAmount;
    return { subtotal, taxAmount, total };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (selectedItems.length === 0) {
      alert('Please add at least one item');
      return;
    }

    try {
      const { subtotal, taxAmount, total } = calculateTotals();

      if (editingBill) {
        const { error: billError } = await supabase
          .from('bills')
          .update({
            customer_name: formData.customer_name,
            customer_phone: formData.customer_phone,
            subtotal,
            tax_amount: taxAmount,
            total_amount: total,
            payment_status: formData.payment_status,
            payment_method: formData.payment_method === 'other' ? formData.custom_payment_method : formData.payment_method,
            notes: formData.notes,
          })
          .eq('id', editingBill.id);

        if (billError) throw billError;

        await supabase.from('bill_items').delete().eq('bill_id', editingBill.id);

        const billItems = selectedItems.map((item) => {
          const menuItem = menuItems.find((m) => m.id === item.menu_item_id);
          return {
            bill_id: editingBill.id,
            menu_item_id: item.menu_item_id,
            menu_item_name: menuItem?.name || '',
            quantity: item.quantity,
            unit_price: item.unit_price,
            total: item.quantity * item.unit_price,
          };
        });

        const { error: itemsError } = await supabase.from('bill_items').insert(billItems);

        if (itemsError) throw itemsError;

        alert('Bill updated successfully!');
      } else {
        const billNumber = generateBillNumber();

        const { data: bill, error: billError } = await supabase
          .from('bills')
          .insert({
            user_id: user?.id,
            bill_number: billNumber,
            customer_name: formData.customer_name,
            customer_phone: formData.customer_phone,
            subtotal,
            tax_amount: taxAmount,
            total_amount: total,
            payment_status: formData.payment_status,
            payment_method: formData.payment_method === 'other' ? formData.custom_payment_method : formData.payment_method,
            notes: formData.notes,
          })
          .select()
          .single();

        if (billError) throw billError;

        const billItems = selectedItems.map((item) => {
          const menuItem = menuItems.find((m) => m.id === item.menu_item_id);
          return {
            bill_id: bill.id,
            menu_item_id: item.menu_item_id,
            menu_item_name: menuItem?.name || '',
            quantity: item.quantity,
            unit_price: item.unit_price,
            total: item.quantity * item.unit_price,
          };
        });

        const { error: itemsError } = await supabase.from('bill_items').insert(billItems);

        if (itemsError) throw itemsError;

        alert('Bill created successfully!');
      }

      setShowModal(false);
      setEditingBill(null);
      setFormData({
        customer_name: '',
        customer_phone: '',
        payment_method: 'cash',
        custom_payment_method: '',
        payment_status: 'paid',
        notes: '',
      });
      setSelectedItems([]);
      loadData();
    } catch (error) {
      console.error('Error saving bill:', error);
      alert('Error saving bill');
    }
  };

  const handleEditBill = async (bill: Bill) => {
    try {
      const { data: billItems, error } = await supabase
        .from('bill_items')
        .select('*')
        .eq('bill_id', bill.id);

      if (error) throw error;

      setEditingBill(bill);

      // Check if payment method is one of the predefined options
      const predefinedMethods = ['cash', 'card', 'upi', 'zomato', 'swiggy', 'jedlo', 'crisf_food'];
      const isCustom = !predefinedMethods.includes(bill.payment_method.toLowerCase());

      setFormData({
        customer_name: bill.customer_name || '',
        customer_phone: bill.customer_phone || '',
        payment_method: isCustom ? 'other' : bill.payment_method,
        custom_payment_method: isCustom ? bill.payment_method : '',
        payment_status: bill.payment_status,
        notes: bill.notes || '',
      });
      setSelectedItems(
        billItems.map((item: any) => ({
          menu_item_id: item.menu_item_id,
          menu_item_name: item.menu_item_name,
          quantity: item.quantity,
          unit_price: item.unit_price,
        }))
      );
      setShowModal(true);
    } catch (error) {
      console.error('Error loading bill for edit:', error);
      alert('Error loading bill');
    }
  };

  const handlePrintBill = async (bill: Bill) => {
    try {
      const { data: billItems, error } = await supabase
        .from('bill_items')
        .select('*')
        .eq('bill_id', bill.id);

      if (error) throw error;

      const printWindow = window.open('', '_blank');
      if (!printWindow) return;

      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Bill - ${bill.bill_number}</title>
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            body {
              font-family: 'Courier New', monospace;
              width: 80mm;
              padding: 5mm;
              font-size: 12px;
              line-height: 1.4;
            }
            .center {
              text-align: center;
            }
            .bold {
              font-weight: bold;
            }
            .header {
              text-align: center;
              margin-bottom: 10px;
              padding-bottom: 10px;
              border-bottom: 1px dashed #000;
            }
            .header h1 {
              font-size: 18px;
              margin-bottom: 5px;
            }
            .header h2 {
              font-size: 14px;
              margin-bottom: 3px;
            }
            .info {
              margin-bottom: 10px;
              padding-bottom: 10px;
              border-bottom: 1px dashed #000;
              font-size: 11px;
            }
            .info div {
              margin-bottom: 2px;
            }
            .items {
              margin-bottom: 10px;
              padding-bottom: 10px;
              border-bottom: 1px dashed #000;
            }
            .item {
              margin-bottom: 8px;
            }
            .item-name {
              font-weight: bold;
              margin-bottom: 2px;
            }
            .item-details {
              display: flex;
              justify-content: space-between;
              font-size: 11px;
            }
            .totals {
              margin-bottom: 10px;
            }
            .totals div {
              display: flex;
              justify-content: space-between;
              margin-bottom: 3px;
            }
            .grand-total {
              font-size: 14px;
              font-weight: bold;
              padding-top: 5px;
              border-top: 1px solid #000;
              margin-top: 5px;
            }
            .footer {
              text-align: center;
              margin-top: 15px;
              padding-top: 10px;
              border-top: 1px dashed #000;
              font-size: 11px;
            }
            @media print {
              body {
                width: 80mm;
                margin: 0;
                padding: 5mm;
              }
              @page {
                size: 80mm auto;
                margin: 0;
              }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>BILL RECEIPT</h1>
            <h2>${bill.bill_number}</h2>
            <div>${new Date(bill.bill_date).toLocaleDateString('en-IN', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}</div>
          </div>

          <div class="info">
            ${bill.customer_name ? `<div><strong>Customer:</strong> ${bill.customer_name}</div>` : ''}
            ${bill.customer_phone ? `<div><strong>Phone:</strong> ${bill.customer_phone}</div>` : ''}
            <div><strong>Payment:</strong> ${bill.payment_method.toUpperCase()}</div>
          </div>

          <div class="items">
            ${billItems
              .map(
                (item: any) => `
              <div class="item">
                <div class="item-name">${item.menu_item_name}</div>
                <div class="item-details">
                  <span>${item.quantity} x ${formatINR(item.unit_price)}</span>
                  <span>${formatINR(item.total)}</span>
                </div>
              </div>
            `
              )
              .join('')}
          </div>

          <div class="totals">
            <div>
              <span>Subtotal:</span>
              <span>${formatINR(bill.subtotal)}</span>
            </div>
            <div>
              <span>Tax (5%):</span>
              <span>${formatINR(bill.tax_amount)}</span>
            </div>
            <div class="grand-total">
              <span>TOTAL:</span>
              <span>${formatINR(bill.total_amount)}</span>
            </div>
          </div>

          ${bill.notes ? `<div style="margin-top: 10px; font-size: 11px; border-top: 1px dashed #000; padding-top: 10px;"><strong>Notes:</strong> ${bill.notes}</div>` : ''}

          <div class="footer">
            <div>Thank you for your visit!</div>
            <div>Please visit again</div>
          </div>

          <script>
            window.onload = function() {
              window.print();
            }
          </script>
        </body>
        </html>
      `);

      printWindow.document.close();
    } catch (error) {
      console.error('Error printing bill:', error);
      alert('Error printing bill');
    }
  };

  const { subtotal, taxAmount, total } = calculateTotals();

  if (loading) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Billing</h1>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition"
        >
          <Plus className="w-5 h-5" />
          Create Bill
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                  Bill Number
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                  Customer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                  Phone
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                  Payment
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {bills.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-slate-500">
                    No bills yet. Create your first bill to get started.
                  </td>
                </tr>
              ) : (
                bills.map((bill) => (
                  <tr key={bill.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 text-sm font-medium text-slate-900">
                      {bill.bill_number}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {new Date(bill.bill_date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {bill.customer_name || '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {bill.customer_phone || '-'}
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-slate-900">
                      {formatINR(bill.total_amount)}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600 capitalize">
                      {bill.payment_method}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          bill.payment_status === 'paid'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}
                      >
                        {bill.payment_status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleEditBill(bill)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded transition"
                          title="Edit Bill"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handlePrintBill(bill)}
                          className="p-2 text-green-600 hover:bg-green-50 rounded transition"
                          title="Print Bill"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200 sticky top-0 bg-white">
              <h2 className="text-xl font-bold text-slate-800">
                {editingBill ? 'Edit Bill' : 'Create New Bill'}
              </h2>
            </div>

            <form onSubmit={handleSubmit} className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Customer Name (Optional)
                  </label>
                  <input
                    type="text"
                    value={formData.customer_name}
                    onChange={(e) =>
                      setFormData({ ...formData, customer_name: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="Enter customer name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Phone (Optional)
                  </label>
                  <input
                    type="tel"
                    value={formData.customer_phone}
                    onChange={(e) =>
                      setFormData({ ...formData, customer_phone: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="Enter phone number"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Payment Method
                  </label>
                  <select
                    value={formData.payment_method}
                    onChange={(e) =>
                      setFormData({ ...formData, payment_method: e.target.value, custom_payment_method: '' })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="cash">Cash</option>
                    <option value="card">Card</option>
                    <option value="upi">UPI</option>
                    <option value="zomato">Zomato</option>
                    <option value="swiggy">Swiggy</option>
                    <option value="jedlo">Jedlo</option>
                    <option value="crisf_food">Crisf Food</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                {formData.payment_method === 'other' && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Custom Payment Method
                    </label>
                    <input
                      type="text"
                      value={formData.custom_payment_method}
                      onChange={(e) =>
                        setFormData({ ...formData, custom_payment_method: e.target.value })
                      }
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Enter payment method"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Payment Status
                  </label>
                  <select
                    value={formData.payment_status}
                    onChange={(e) =>
                      setFormData({ ...formData, payment_status: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="paid">Paid</option>
                    <option value="pending">Pending</option>
                  </select>
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Notes (Optional)
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="Add any notes"
                />
              </div>

              <div className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-sm font-medium text-slate-700">Menu Items</label>
                  <button
                    type="button"
                    onClick={addItem}
                    className="px-3 py-1 bg-slate-600 hover:bg-slate-700 text-white text-sm font-medium rounded-lg transition"
                  >
                    Add Menu Item
                  </button>
                </div>

                <div className="space-y-3">
                  {selectedItems.map((item, index) => {
                    const menuItem = menuItems.find((m) => m.id === item.menu_item_id);
                    return (
                      <div key={index} className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                        <div className="flex gap-3 items-start">
                          <select
                            value={item.menu_item_id}
                            onChange={(e) => updateItem(index, 'menu_item_id', e.target.value)}
                            className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white"
                          >
                            {menuItems.map((menuItem) => (
                              <option key={menuItem.id} value={menuItem.id}>
                                {menuItem.name} - {formatINR(menuItem.price)}
                              </option>
                            ))}
                          </select>

                          <input
                            type="number"
                            min="1"
                            step="1"
                            value={item.quantity}
                            onChange={(e) => updateItem(index, 'quantity', parseFloat(e.target.value))}
                            className="w-24 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                            placeholder="Qty"
                          />

                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.unit_price}
                            onChange={(e) => updateItem(index, 'unit_price', parseFloat(e.target.value))}
                            className="w-32 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                            placeholder="Price"
                          />

                          <div className="w-32 px-4 py-2 bg-slate-100 border border-slate-300 rounded-lg text-slate-700 font-medium">
                            {formatINR(item.quantity * item.unit_price)}
                          </div>

                          <button
                            type="button"
                            onClick={() => removeItem(index)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {selectedItems.length === 0 && (
                  <div className="text-center py-8 text-slate-500">
                    No items added. Click "Add Menu Item" to start.
                  </div>
                )}
              </div>

              {selectedItems.length > 0 && (
                <div className="bg-slate-50 rounded-lg p-4 mb-6 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Subtotal:</span>
                    <span className="font-medium text-slate-900">{formatINR(subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Tax (5%):</span>
                    <span className="font-medium text-slate-900">{formatINR(taxAmount)}</span>
                  </div>
                  <div className="flex justify-between text-lg font-bold border-t border-slate-300 pt-2">
                    <span className="text-slate-800">Total:</span>
                    <span className="text-blue-600">{formatINR(total)}</span>
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition"
                >
                  {editingBill ? 'Update Bill' : 'Create Bill'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setEditingBill(null);
                    setFormData({
                      customer_name: '',
                      customer_phone: '',
                      payment_method: 'cash',
                      payment_status: 'paid',
                      notes: '',
                    });
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
    </div>
  );
}
