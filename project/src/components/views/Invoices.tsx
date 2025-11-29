import { useEffect, useState } from 'react';
import { supabase, Invoice, Customer, Product, InvoiceItem, CompanyProfile } from '../../lib/supabase';
import { Plus, Search, Eye, CreditCard as Edit, Trash2, Printer, ChevronDown, UserPlus } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { InvoiceView } from './InvoiceView';
import { formatINR } from '../../lib/currency';
import { calculateGST, calculateItemGST } from '../../lib/gst';

export function Invoices() {
  const { profile, user } = useAuth();
  const [invoices, setInvoices] = useState<(Invoice & { customer: Customer })[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [viewInvoiceId, setViewInvoiceId] = useState<string | null>(null);
  const [printDropdownOpen, setPrintDropdownOpen] = useState<string | null>(null);
  const [showCustomerForm, setShowCustomerForm] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Array<{ menu_item_id: string; quantity: number; custom_price?: number }>>([]);
  const [formData, setFormData] = useState({
    customer_id: '',
    tax_rate: '10',
    include_gst: true,
  });
  const [newCustomerData, setNewCustomerData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    state: '',
    gstin: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const handleClickOutside = () => {
      if (printDropdownOpen) {
        setPrintDropdownOpen(null);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [printDropdownOpen]);

  const loadData = async () => {
    try {
      const [invoicesRes, customersRes, productsRes, menuItemsRes, companyRes] = await Promise.all([
        supabase
          .from('invoices')
          .select('*, customer:customers(*)')
          .order('created_at', { ascending: false }),
        supabase.from('customers').select('*').order('name'),
        supabase.from('products').select('*').order('name'),
        supabase.from('menu_items').select('*').eq('is_active', true).eq('is_available', true).order('name'),
        supabase.from('company_profile').select('*').eq('user_id', user?.id || '').maybeSingle(),
      ]);

      if (invoicesRes.error) throw invoicesRes.error;
      if (customersRes.error) throw customersRes.error;
      if (productsRes.error) throw productsRes.error;
      if (menuItemsRes.error) {
        console.error('Menu items error:', menuItemsRes.error);
        throw menuItemsRes.error;
      }

      console.log('Loaded menu items:', menuItemsRes.data);
      setInvoices(invoicesRes.data || []);
      setCustomers(customersRes.data || []);
      setProducts(productsRes.data || []);
      setMenuItems(menuItemsRes.data || []);
      setCompanyProfile(companyRes.data);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateInvoiceNumber = () => {
    const date = new Date();
    const timestamp = date.getTime().toString().slice(-6);
    return `INV-${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}-${timestamp}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedItems.length === 0) {
      alert('Please add at least one item');
      return;
    }

    if (!companyProfile?.state) {
      alert('Please set up your company profile with state information first');
      return;
    }

    try {
      const customer = formData.customer_id ? customers.find(c => c.id === formData.customer_id) : null;
      const customerState = customer?.state || companyProfile.state;
      let totalGstAmount = 0;
      let subtotal = 0;

      const items = selectedItems.map(item => {
        const menuItem = menuItems.find(m => m.id === item.menu_item_id);
        if (!menuItem) throw new Error('Menu item not found');

        const unitPrice = item.custom_price !== undefined ? item.custom_price : menuItem.price;
        const itemName = menuItem.name;
        const hsnCode = menuItem.hsn_code || '';
        const gstRate = menuItem.gst_rate || 5;

        const itemTotal = unitPrice * item.quantity;
        subtotal += itemTotal;

        const isInterstate = companyProfile.state?.toLowerCase() !== customerState?.toLowerCase();
        const gstCalc = calculateItemGST(itemTotal, gstRate, isInterstate);
        totalGstAmount += (gstCalc.cgst_amount + gstCalc.sgst_amount + gstCalc.igst_amount);

        return {
          product_id: null,
          menu_item_id: item.menu_item_id,
          product_name: null,
          menu_item_name: itemName,
          quantity: item.quantity,
          unit_price: unitPrice,
          total: itemTotal,
          hsn_code: hsnCode,
          gst_rate: gstRate,
          cgst_amount: gstCalc.cgst_amount,
          sgst_amount: gstCalc.sgst_amount,
          igst_amount: gstCalc.igst_amount,
        };
      });

      const isInterstate = companyProfile.state?.toLowerCase() !== customerState?.toLowerCase();
      const gstCalculation = calculateGST(subtotal, 0, companyProfile.state || '', customerState || '');
      const totalWithGst = formData.include_gst ? subtotal + totalGstAmount : subtotal;

      const { data: invoice, error: invoiceError } = await supabase
        .from('invoices')
        .insert([
          {
            invoice_number: generateInvoiceNumber(),
            customer_id: formData.customer_id || null,
            status: 'draft',
            subtotal,
            tax: formData.include_gst ? totalGstAmount : 0,
            cgst: formData.include_gst && !isInterstate ? totalGstAmount / 2 : 0,
            sgst: formData.include_gst && !isInterstate ? totalGstAmount / 2 : 0,
            igst: formData.include_gst && isInterstate ? totalGstAmount : 0,
            total: totalWithGst,
            is_interstate: isInterstate,
            place_of_supply: customerState,
            created_by: profile?.id,
          },
        ])
        .select()
        .single();

      if (invoiceError) throw invoiceError;

      const invoiceItems = items.map(item => ({
        ...item,
        invoice_id: invoice.id,
      }));

      const { error: itemsError } = await supabase
        .from('invoice_items')
        .insert(invoiceItems);

      if (itemsError) throw itemsError;

      setShowModal(false);
      setFormData({ customer_id: '', tax_rate: '10', include_gst: true });
      setSelectedItems([]);
      loadData();
    } catch (error) {
      console.error('Error creating invoice:', error);
      alert('Error creating invoice');
    }
  };

  const handleStatusUpdate = async (id: string, status: string) => {
    try {
      const invoice = invoices.find(inv => inv.id === id);
      if (!invoice) throw new Error('Invoice not found');

      const wasPreviouslyPaid = invoice.payment_status === 'paid' || invoice.payment_status === 'partial';
      const isNowPaid = status === 'paid';

      if (isNowPaid && !wasPreviouslyPaid) {
        const { data: invoiceItems, error: itemsError } = await supabase
          .from('invoice_items')
          .select('product_id, quantity')
          .eq('invoice_id', id);

        if (itemsError) throw itemsError;

        for (const item of invoiceItems || []) {
          // Skip items without product_id (e.g., KOT menu items)
          if (!item.product_id) continue;

          const { data: product, error: productError } = await supabase
            .from('products')
            .select('quantity')
            .eq('id', item.product_id)
            .single();

          if (productError) throw productError;

          const newQuantity = product.quantity - item.quantity;

          const { error: updateError } = await supabase
            .from('products')
            .update({ quantity: newQuantity })
            .eq('id', item.product_id);

          if (updateError) throw updateError;

          const { error: movementError } = await supabase
            .from('inventory_movements')
            .insert([{
              product_id: item.product_id,
              type: 'out',
              quantity: item.quantity,
              reason: `Invoice ${invoice.invoice_number} marked as paid`,
              created_by: profile?.id,
            }]);

          if (movementError) throw movementError;
        }
      }

      const updateData: any = { status };
      if (status === 'paid') {
        updateData.paid_date = new Date().toISOString().split('T')[0];
        updateData.payment_status = 'paid';
        updateData.amount_paid = invoice.total;
      }

      const { error } = await supabase
        .from('invoices')
        .update(updateData)
        .eq('id', id);

      if (error) throw error;
      loadData();
    } catch (error) {
      console.error('Error updating invoice:', error);
      alert('Error updating invoice: ' + (error as Error).message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this invoice?')) return;

    try {
      const { error } = await supabase
        .from('invoices')
        .delete()
        .eq('id', id);

      if (error) throw error;
      loadData();
    } catch (error) {
      console.error('Error deleting invoice:', error);
      alert('Error deleting invoice');
    }
  };

  const handleDirectPrint = async (invoiceId: string, format: 'full' | 'thermal') => {
    try {
      const [invoiceRes, profileRes] = await Promise.all([
        supabase
          .from('invoices')
          .select(`
            *,
            customer:customers(*),
            items:invoice_items(
              *,
              product:products(*)
            )
          `)
          .eq('id', invoiceId)
          .single(),
        supabase
          .from('company_profile')
          .select('*')
          .maybeSingle(),
      ]);

      if (invoiceRes.error) throw invoiceRes.error;

      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        alert('Please allow pop-ups to print invoices');
        return;
      }

      const invoice = invoiceRes.data;
      const profile = profileRes.data;
      const { customer, items } = invoice;

      const printContent = format === 'full' ? `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Invoice ${invoice.invoice_number}</title>
            <style>
              @page { size: A4; margin: 0; }
              * { margin: 0; padding: 0; box-sizing: border-box; }
              body { font-family: Arial, sans-serif; }
              .container { padding: 60px; max-width: 800px; margin: 0 auto; }
              .header { background: linear-gradient(to right, #1e293b, #475569); color: white; padding: 30px; border-radius: 10px 10px 0 0; margin: -15px; margin-bottom: 30px; }
              .header h1 { font-size: 36px; margin-bottom: 10px; }
              .header-right { text-align: right; }
              .invoice-title { font-size: 48px; font-weight: bold; }
              .invoice-number { font-size: 20px; color: #cbd5e1; }
              .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-bottom: 30px; }
              .info-box { background: #f8fafc; padding: 20px; border-radius: 10px; border-left: 4px solid #3b82f6; }
              .info-box.dark { border-left-color: #1e293b; }
              .info-label { font-size: 11px; font-weight: bold; color: #64748b; text-transform: uppercase; margin-bottom: 10px; }
              .info-value { font-size: 18px; font-weight: 600; color: #1e293b; }
              table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
              thead { background: #1e293b; color: white; }
              th { padding: 15px; text-align: left; font-size: 12px; text-transform: uppercase; }
              td { padding: 15px; border-bottom: 1px solid #e2e8f0; }
              tbody tr:nth-child(even) { background: #f8fafc; }
              .totals { width: 350px; margin-left: auto; }
              .totals-row { display: flex; justify-content: space-between; padding: 10px 0; }
              .total-final { background: linear-gradient(to right, #1e293b, #475569); color: white; padding: 20px; border-radius: 10px; margin-top: 10px; }
              .total-final .amount { font-size: 30px; font-weight: bold; }
              .payment-box { background: #eff6ff; padding: 20px; border-radius: 10px; border-left: 4px solid #3b82f6; margin-bottom: 20px; }
              .footer { background: #1e293b; color: white; padding: 20px; text-align: center; border-radius: 0 0 10px 10px; margin: 30px -15px -15px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <table style="width: 100%; color: white;">
                  <tr>
                    <td>
                      <h1>${profile?.company_name || 'Company Name'}</h1>
                      <div style="font-size: 14px; color: #cbd5e1;">
                        ${profile?.address_line1 ? `<div>${profile.address_line1}</div>` : ''}
                        ${profile?.address_line2 ? `<div>${profile.address_line2}</div>` : ''}
                        <div>${profile?.city || ''}, ${profile?.state || ''} ${profile?.postal_code || ''}</div>
                      </div>
                    </td>
                    <td class="header-right">
                      <div class="invoice-title">INVOICE</div>
                      <div class="invoice-number">#${invoice.invoice_number}</div>
                    </td>
                  </tr>
                </table>
              </div>

              <div class="info-grid">
                <div>
                  <div class="info-label">Invoice Date</div>
                  <div class="info-value">${new Date(invoice.created_at).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
                </div>
              </div>

              <div class="info-grid">
                <div class="info-box">
                  <div class="info-label">Bill To</div>
                  <div style="font-weight: bold; font-size: 18px; margin-bottom: 5px;">${customer?.name || ''}</div>
                  ${customer?.email ? `<div style="font-size: 14px; color: #64748b;">${customer.email}</div>` : ''}
                  ${customer?.phone ? `<div style="font-size: 14px; color: #64748b;">${customer.phone}</div>` : ''}
                  ${customer?.address ? `<div style="font-size: 14px; color: #64748b; margin-top: 8px;">${customer.address}</div>` : ''}
                  ${customer?.gstin ? `<div style="font-size: 14px; margin-top: 8px;"><strong>GSTIN:</strong> ${customer.gstin}</div>` : ''}
                </div>
                <div class="info-box dark">
                  <div class="info-label">Company Info</div>
                  ${profile?.phone ? `<div style="font-size: 14px;"><strong>Phone:</strong> ${profile.phone}</div>` : ''}
                  ${profile?.email ? `<div style="font-size: 14px;"><strong>Email:</strong> ${profile.email}</div>` : ''}
                  ${profile?.gst_number ? `<div style="font-size: 14px;"><strong>GSTIN:</strong> ${profile.gst_number}</div>` : ''}
                  ${profile?.pan_number ? `<div style="font-size: 14px;"><strong>PAN:</strong> ${profile.pan_number}</div>` : ''}
                </div>
              </div>

              <table>
                <thead>
                  <tr>
                    <th>Description</th>
                    <th style="text-align: center;">HSN</th>
                    <th style="text-align: center;">Qty</th>
                    <th style="text-align: right;">Rate</th>
                    <th style="text-align: center;">GST</th>
                    <th style="text-align: right;">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  ${items.map((item: any) => `
                    <tr>
                      <td style="font-weight: 500;">${item.menu_item_name || item.product_name || item.product?.name || 'N/A'}</td>
                      <td style="text-align: center; color: #64748b;">${item.hsn_code || '-'}</td>
                      <td style="text-align: center;">${item.quantity}</td>
                      <td style="text-align: right;">₹${item.unit_price.toFixed(2)}</td>
                      <td style="text-align: center; color: #64748b;">${item.gst_rate}%</td>
                      <td style="text-align: right; font-weight: 600;">₹${item.total.toFixed(2)}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>

              <div class="totals">
                <div class="totals-row">
                  <span>Subtotal</span>
                  <span style="font-weight: 600;">₹${invoice.subtotal.toFixed(2)}</span>
                </div>
                ${invoice.is_interstate ? `
                  <div class="totals-row">
                    <span>IGST</span>
                    <span style="font-weight: 600;">₹${invoice.igst.toFixed(2)}</span>
                  </div>
                ` : `
                  <div class="totals-row">
                    <span>CGST</span>
                    <span style="font-weight: 600;">₹${invoice.cgst.toFixed(2)}</span>
                  </div>
                  <div class="totals-row">
                    <span>SGST</span>
                    <span style="font-weight: 600;">₹${invoice.sgst.toFixed(2)}</span>
                  </div>
                `}
                <div class="total-final">
                  <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-size: 18px; font-weight: bold;">TOTAL AMOUNT</span>
                    <span class="amount">₹${invoice.total.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              ${profile?.bank_name ? `
                <div class="payment-box">
                  <div class="info-label">Payment Details</div>
                  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-top: 10px;">
                    <div><strong>Bank:</strong> ${profile.bank_name}</div>
                    ${profile.account_number ? `<div><strong>Account:</strong> ${profile.account_number}</div>` : ''}
                    ${profile.ifsc_code ? `<div><strong>IFSC:</strong> ${profile.ifsc_code}</div>` : ''}
                  </div>
                </div>
              ` : ''}

              ${profile?.terms_conditions ? `
                <div class="info-box dark">
                  <div class="info-label">Terms & Conditions</div>
                  <div style="font-size: 12px; line-height: 1.6; color: #475569; white-space: pre-line;">${profile.terms_conditions}</div>
                </div>
              ` : ''}

              <div class="footer">
                <div style="font-weight: 500;">Thank you for your business!</div>
                ${profile?.website ? `<div style="font-size: 12px; color: #cbd5e1; margin-top: 5px;">${profile.website}</div>` : ''}
              </div>
            </div>
          </body>
        </html>
      ` : `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Receipt ${invoice.invoice_number}</title>
            <style>
              @page { size: 80mm auto; margin: 5mm; }
              * { margin: 0; padding: 0; box-sizing: border-box; }
              body { font-family: Arial, sans-serif; width: 80mm; padding: 10px; font-size: 12px; }
              .center { text-align: center; }
              .bold { font-weight: bold; }
              .line { border-top: 1px dashed #000; margin: 10px 0; }
              table { width: 100%; border-collapse: collapse; margin: 10px 0; }
              th { text-align: left; border-bottom: 1px solid #000; padding: 5px 0; }
              td { padding: 3px 0; }
            </style>
          </head>
          <body>
            <div class="center bold" style="font-size: 18px; margin-bottom: 5px;">${profile?.company_name || 'Company'}</div>
            ${profile?.address_line1 ? `<div class="center" style="font-size: 11px;">${profile.address_line1}</div>` : ''}
            ${profile?.phone ? `<div class="center" style="font-size: 11px;">Tel: ${profile.phone}</div>` : ''}
            ${profile?.gst_number ? `<div class="center" style="font-size: 11px;">GST: ${profile.gst_number}</div>` : ''}

            <div class="line"></div>
            <div class="center bold" style="font-size: 16px;">INVOICE</div>
            <div class="center">No: ${invoice.invoice_number}</div>
            <div class="center">Date: ${new Date(invoice.created_at).toLocaleDateString('en-IN')}</div>
            <div class="line"></div>

            <div class="bold">Customer: ${customer?.name || ''}</div>
            ${customer?.phone ? `<div>Ph: ${customer.phone}</div>` : ''}
            <div class="line"></div>

            <table>
              <thead>
                <tr>
                  <th>Item</th>
                  <th style="text-align: center;">Qty</th>
                  <th style="text-align: right;">Amt</th>
                </tr>
              </thead>
              <tbody>
                ${items.map((item: any) => `
                  <tr>
                    <td>${item.product?.name || ''}</td>
                    <td style="text-align: center;">${item.quantity}</td>
                    <td style="text-align: right;">₹${item.total.toFixed(2)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>

            <div class="line"></div>
            <div style="display: flex; justify-content: space-between;">
              <span>Subtotal:</span>
              <span>₹${invoice.subtotal.toFixed(2)}</span>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span>Tax:</span>
              <span>₹${invoice.tax.toFixed(2)}</span>
            </div>
            <div class="line"></div>
            <div style="display: flex; justify-content: space-between;" class="bold">
              <span>TOTAL:</span>
              <span style="font-size: 16px;">₹${invoice.total.toFixed(2)}</span>
            </div>
            <div class="line"></div>
            <div class="center">Thank you!</div>
          </body>
        </html>
      `;

      printWindow.document.write(printContent);
      printWindow.document.close();

      printWindow.onload = () => {
        printWindow.focus();
        setTimeout(() => {
          printWindow.print();
          printWindow.close();
        }, 250);
      };
    } catch (error) {
      console.error('Error printing invoice:', error);
      alert('Error loading invoice for printing');
    }
  };

  const addItem = () => {
    if (menuItems.length === 0) {
      alert('Please add menu items first');
      return;
    }
    setSelectedItems([...selectedItems, { menu_item_id: menuItems[0].id, quantity: 1 }]);
  };

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const customerData = {
        name: newCustomerData.name,
        email: newCustomerData.email || null,
        phone: newCustomerData.phone || null,
        address: newCustomerData.address || null,
        state: newCustomerData.state || '',
        gstin: newCustomerData.gstin || '',
        created_by: profile?.id,
      };

      const { data, error } = await supabase
        .from('customers')
        .insert([customerData])
        .select()
        .single();

      if (error) throw error;

      setCustomers([...customers, data]);
      setFormData({ ...formData, customer_id: data.id });
      setShowCustomerForm(false);
      setNewCustomerData({
        name: '',
        email: '',
        phone: '',
        address: '',
        state: '',
        gstin: '',
      });
    } catch (error) {
      console.error('Error creating customer:', error);
      alert('Error creating customer');
    }
  };


  const removeItem = (index: number) => {
    setSelectedItems(selectedItems.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: string, value: any) => {
    const newItems = [...selectedItems];
    newItems[index] = { ...newItems[index], [field]: value };
    setSelectedItems(newItems);
  };

  const filteredInvoices = invoices.filter(invoice =>
    invoice.invoice_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    invoice.customer?.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'bg-green-100 text-green-700';
      case 'sent': return 'bg-blue-100 text-blue-700';
      case 'draft': return 'bg-slate-100 text-slate-700';
      case 'cancelled': return 'bg-red-100 text-red-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  if (loading) {
    return <div className="text-center py-8">Loading invoices...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search invoices..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          />
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition"
        >
          <Plus className="w-5 h-5" />
          Create Invoice
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">Invoice #</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">Customer</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">Amount</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-slate-600 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredInvoices.map((invoice) => (
                <tr key={invoice.id} className="hover:bg-slate-50 transition">
                  <td className="px-6 py-4 text-sm font-medium text-slate-900">{invoice.invoice_number}</td>
                  <td className="px-6 py-4 text-sm text-slate-900">{invoice.customer?.name}</td>
                  <td className="px-6 py-4 text-sm text-slate-600">
                    {new Date(invoice.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-slate-900">{formatINR(invoice.total)}</td>
                  <td className="px-6 py-4">
                    <select
                      value={invoice.status}
                      onChange={(e) => handleStatusUpdate(invoice.id, e.target.value)}
                      className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(invoice.status)} border-0 outline-none cursor-pointer`}
                    >
                      <option value="draft">Draft</option>
                      <option value="sent">Sent</option>
                      <option value="paid">Paid</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => setViewInvoiceId(invoice.id)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                        title="View Invoice"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <div className="relative">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setPrintDropdownOpen(printDropdownOpen === invoice.id ? null : invoice.id);
                          }}
                          className="flex items-center gap-1 p-2 text-green-600 hover:bg-green-50 rounded-lg transition"
                          title="Print Invoice"
                        >
                          <Printer className="w-4 h-4" />
                          <ChevronDown className="w-3 h-3" />
                        </button>
                        {printDropdownOpen === invoice.id && (
                          <div className="absolute right-0 mt-1 w-56 bg-white rounded-lg shadow-xl border border-slate-200 z-50">
                            <div className="p-2 space-y-1">
                              <button
                                onClick={() => {
                                  handleDirectPrint(invoice.id, 'full');
                                  setPrintDropdownOpen(null);
                                }}
                                className="w-full flex items-center gap-3 px-4 py-3 text-left text-slate-700 hover:bg-blue-50 rounded-lg transition"
                              >
                                <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                                  <Printer className="w-4 h-4 text-blue-600" />
                                </div>
                                <div>
                                  <div className="font-semibold text-sm text-slate-900">A4 Full Page</div>
                                  <div className="text-xs text-slate-500">Business invoice</div>
                                </div>
                              </button>
                              <button
                                onClick={() => {
                                  handleDirectPrint(invoice.id, 'thermal');
                                  setPrintDropdownOpen(null);
                                }}
                                className="w-full flex items-center gap-3 px-4 py-3 text-left text-slate-700 hover:bg-green-50 rounded-lg transition"
                              >
                                <div className="flex-shrink-0 w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                                  <Printer className="w-4 h-4 text-green-600" />
                                </div>
                                <div>
                                  <div className="font-semibold text-sm text-slate-900">Thermal Receipt</div>
                                  <div className="text-xs text-slate-500">80mm POS printer</div>
                                </div>
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                      {profile?.role === 'admin' && (
                        <button
                          onClick={() => handleDelete(invoice.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200">
              <h2 className="text-2xl font-bold text-slate-900">Create New Invoice</h2>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Customer</label>
                  <div className="flex gap-2">
                    <select
                      value={formData.customer_id}
                      onChange={(e) => setFormData({ ...formData, customer_id: e.target.value })}
                      className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    >
                      <option value="">Select Customer (Optional)</option>
                      {customers.map(customer => (
                        <option key={customer.id} value={customer.id}>{customer.name}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => setShowCustomerForm(!showCustomerForm)}
                      className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition flex items-center gap-2"
                      title="Add New Customer"
                    >
                      <UserPlus className="w-4 h-4" />
                      New
                    </button>
                  </div>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.include_gst}
                    onChange={(e) => setFormData({ ...formData, include_gst: e.target.checked })}
                    className="w-5 h-5 text-blue-600 border-slate-300 rounded focus:ring-2 focus:ring-blue-500"
                  />
                  <div>
                    <div className="text-sm font-semibold text-slate-900">Include GST in Invoice</div>
                    <div className="text-xs text-slate-600">Toggle to create invoice with or without GST calculations</div>
                  </div>
                </label>
              </div>

              {showCustomerForm && (
                <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-slate-900 mb-4">New Customer</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Name *</label>
                      <input
                        type="text"
                        value={newCustomerData.name}
                        onChange={(e) => setNewCustomerData({ ...newCustomerData, name: e.target.value })}
                        required
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
                      <input
                        type="tel"
                        value={newCustomerData.phone}
                        onChange={(e) => setNewCustomerData({ ...newCustomerData, phone: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                      <input
                        type="email"
                        value={newCustomerData.email}
                        onChange={(e) => setNewCustomerData({ ...newCustomerData, email: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">State</label>
                      <select
                        value={newCustomerData.state}
                        onChange={(e) => setNewCustomerData({ ...newCustomerData, state: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                      >
                        <option value="">Select State</option>
                        <option value="Andhra Pradesh">Andhra Pradesh</option>
                        <option value="Arunachal Pradesh">Arunachal Pradesh</option>
                        <option value="Assam">Assam</option>
                        <option value="Bihar">Bihar</option>
                        <option value="Chhattisgarh">Chhattisgarh</option>
                        <option value="Goa">Goa</option>
                        <option value="Gujarat">Gujarat</option>
                        <option value="Haryana">Haryana</option>
                        <option value="Himachal Pradesh">Himachal Pradesh</option>
                        <option value="Jharkhand">Jharkhand</option>
                        <option value="Karnataka">Karnataka</option>
                        <option value="Kerala">Kerala</option>
                        <option value="Madhya Pradesh">Madhya Pradesh</option>
                        <option value="Maharashtra">Maharashtra</option>
                        <option value="Manipur">Manipur</option>
                        <option value="Meghalaya">Meghalaya</option>
                        <option value="Mizoram">Mizoram</option>
                        <option value="Nagaland">Nagaland</option>
                        <option value="Odisha">Odisha</option>
                        <option value="Punjab">Punjab</option>
                        <option value="Rajasthan">Rajasthan</option>
                        <option value="Sikkim">Sikkim</option>
                        <option value="Tamil Nadu">Tamil Nadu</option>
                        <option value="Telangana">Telangana</option>
                        <option value="Tripura">Tripura</option>
                        <option value="Uttar Pradesh">Uttar Pradesh</option>
                        <option value="Uttarakhand">Uttarakhand</option>
                        <option value="West Bengal">West Bengal</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">GSTIN</label>
                      <input
                        type="text"
                        value={newCustomerData.gstin}
                        onChange={(e) => setNewCustomerData({ ...newCustomerData, gstin: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-slate-700 mb-1">Address</label>
                      <textarea
                        value={newCustomerData.address}
                        onChange={(e) => setNewCustomerData({ ...newCustomerData, address: e.target.value })}
                        rows={2}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                      />
                    </div>
                  </div>
                  <div className="flex gap-3 mt-4">
                    <button
                      type="button"
                      onClick={handleCreateCustomer}
                      className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition"
                    >
                      Save Customer
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowCustomerForm(false);
                        setNewCustomerData({ name: '', email: '', phone: '', address: '', state: '', gstin: '' });
                      }}
                      className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-medium rounded-lg transition"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              <div>
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
                    const menuItem = menuItems.find(m => m.id === item.menu_item_id);
                    const displayPrice = item.custom_price !== undefined ? item.custom_price : (menuItem?.price || 0);
                    console.log('Rendering item dropdown, menuItems count:', menuItems.length, 'menuItems:', menuItems);
                    return (
                      <div key={index} className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                        <div className="flex gap-3 items-start mb-3">
                          <select
                            value={item.menu_item_id}
                            onChange={(e) => updateItem(index, 'menu_item_id', e.target.value)}
                            className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white"
                          >
                            {menuItems.length === 0 ? (
                              <option value="">No menu items available</option>
                            ) : (
                              menuItems.map(menuItem => (
                                <option key={menuItem.id} value={menuItem.id}>
                                  {menuItem.name} - {formatINR(menuItem.price)}
                                </option>
                              ))
                            )}
                          </select>
                          <input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value))}
                            placeholder="Qty"
                            className="w-24 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white"
                          />
                          <button
                            type="button"
                            onClick={() => removeItem(index)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                        <div className="flex items-center gap-3">
                          <label className="text-sm font-medium text-slate-700 whitespace-nowrap">Custom Price:</label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.custom_price !== undefined ? item.custom_price : ''}
                            onChange={(e) => updateItem(index, 'custom_price', e.target.value ? parseFloat(e.target.value) : undefined)}
                            placeholder={`Default: ${formatINR(menuItem?.price || 0)}`}
                            className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white"
                          />
                          <span className="text-sm font-semibold text-slate-900 whitespace-nowrap min-w-[100px] text-right">
                            Total: {formatINR(displayPrice * item.quantity)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  <strong>Note:</strong> GST will be calculated automatically based on product GST rates and customer location.
                  {companyProfile?.state && ` Company State: ${companyProfile.state}`}
                </p>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition"
                >
                  Create Invoice
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setFormData({ customer_id: '', tax_rate: '10', include_gst: true });
                    setSelectedItems([]);
                    setShowCustomerForm(false);
                    setNewCustomerData({ name: '', email: '', phone: '', address: '', state: '', gstin: '' });
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

      {viewInvoiceId && (
        <InvoiceView
          invoiceId={viewInvoiceId}
          onClose={() => setViewInvoiceId(null)}
        />
      )}
    </div>
  );
}
