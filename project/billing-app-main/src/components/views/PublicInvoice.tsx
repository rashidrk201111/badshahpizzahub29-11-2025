import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Printer, FileDown } from 'lucide-react';
import { formatINR } from '../../lib/currency';

interface CompanyProfile {
  company_name: string;
  gst_number: string;
  pan_number: string;
  address_line1: string;
  address_line2: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  phone: string;
  email: string;
  website: string;
  bank_name: string;
  account_number: string;
  ifsc_code: string;
  terms_conditions: string;
}

export function PublicInvoice() {
  const [loading, setLoading] = useState(true);
  const [invoiceData, setInvoiceData] = useState<any>(null);
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const invoiceId = params.get('id');

    if (!invoiceId) {
      setError('Invoice ID is missing');
      setLoading(false);
      return;
    }

    loadInvoiceData(invoiceId);
  }, []);

  useEffect(() => {
    const style = document.createElement('style');
    style.innerHTML = `
      @media print {
        body * {
          visibility: hidden;
        }
        #invoice-content, #invoice-content * {
          visibility: visible;
        }
        #invoice-content {
          position: absolute;
          left: 0;
          top: 0;
          width: 210mm;
        }
        .print\\:hidden {
          display: none !important;
        }
        @page {
          size: A4;
          margin: 0;
        }
      }
    `;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  const loadInvoiceData = async (invoiceId: string) => {
    try {
      const [invoiceRes, itemsRes] = await Promise.all([
        supabase
          .from('invoices')
          .select(`
            *,
            customer:customers(*)
          `)
          .eq('id', invoiceId)
          .maybeSingle(),
        supabase
          .from('invoice_items')
          .select(`
            *,
            product:products(*)
          `)
          .eq('invoice_id', invoiceId),
      ]);

      if (invoiceRes.error) throw invoiceRes.error;
      if (itemsRes.error) throw itemsRes.error;

      if (!invoiceRes.data) {
        setError('Invoice not found');
        setLoading(false);
        return;
      }

      const invoice = { ...invoiceRes.data, items: itemsRes.data || [] };
      setInvoiceData(invoice);

      const profileRes = await supabase
        .from('company_profile')
        .select('*')
        .eq('user_id', invoice.created_by)
        .maybeSingle();

      if (!profileRes.error && profileRes.data) {
        setCompanyProfile(profileRes.data);
      }
    } catch (error) {
      console.error('Error loading invoice:', error);
      setError('Failed to load invoice');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-slate-600">Loading invoice...</p>
        </div>
      </div>
    );
  }

  if (error || !invoiceData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="text-red-600 text-xl mb-4">{error || 'Invoice not found'}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow-lg mb-4 print:hidden">
          <div className="p-4 flex gap-3 justify-center">
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              <Printer className="w-5 h-5" />
              Print Invoice
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
            >
              <FileDown className="w-5 h-5" />
              Download PDF
            </button>
          </div>
        </div>

        <div id="invoice-content" className="bg-white rounded-lg shadow-lg p-8">
          <div className="border-b-2 border-slate-200 pb-6 mb-6">
            <div className="flex justify-between items-start">
              <div className="flex items-start gap-6">
                {companyProfile?.logo_url && (
                  <div className="flex-shrink-0">
                    <img
                      src={companyProfile.logo_url}
                      alt="Company Logo"
                      className="h-20 w-20 object-contain border-2 border-slate-200 rounded-lg p-2"
                    />
                  </div>
                )}
                <div>
                  <h1 className="text-3xl font-bold text-slate-900 mb-2">
                    {companyProfile?.company_name || 'Company Name'}
                  </h1>
                  <div className="text-sm text-slate-600 space-y-1">
                    {companyProfile?.address_line1 && <p>{companyProfile.address_line1}</p>}
                    {companyProfile?.address_line2 && <p>{companyProfile.address_line2}</p>}
                    {(companyProfile?.city || companyProfile?.state) && (
                      <p>{[companyProfile.city, companyProfile.state, companyProfile.postal_code].filter(Boolean).join(', ')}</p>
                    )}
                    {companyProfile?.phone && <p>Phone: {companyProfile.phone}</p>}
                    {companyProfile?.email && <p>Email: {companyProfile.email}</p>}
                    {companyProfile?.gst_number && <p>GSTIN: {companyProfile.gst_number}</p>}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-blue-600 mb-2">INVOICE</div>
                <div className="text-sm space-y-1">
                  <p><span className="font-semibold">Invoice #:</span> {invoiceData.invoice_number}</p>
                  <p><span className="font-semibold">Date:</span> {new Date(invoiceData.invoice_date).toLocaleDateString('en-IN')}</p>
                  <p><span className="font-semibold">Due Date:</span> {new Date(invoiceData.due_date).toLocaleDateString('en-IN')}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="mb-6">
            <h3 className="text-sm font-semibold text-slate-500 uppercase mb-2">Bill To:</h3>
            <div className="text-slate-900">
              <p className="font-semibold text-lg">{invoiceData.customer.name}</p>
              {invoiceData.customer.email && <p className="text-sm">{invoiceData.customer.email}</p>}
              {invoiceData.customer.phone && <p className="text-sm">{invoiceData.customer.phone}</p>}
              {invoiceData.customer.address && <p className="text-sm">{invoiceData.customer.address}</p>}
              {invoiceData.customer.gstin && <p className="text-sm">GSTIN: {invoiceData.customer.gstin}</p>}
            </div>
          </div>

          <table className="w-full mb-6">
            <thead>
              <tr className="bg-slate-100 border-b-2 border-slate-300">
                <th className="text-left p-3 font-semibold text-slate-700">Item</th>
                <th className="text-right p-3 font-semibold text-slate-700">Qty</th>
                <th className="text-right p-3 font-semibold text-slate-700">Rate</th>
                <th className="text-right p-3 font-semibold text-slate-700">Amount</th>
              </tr>
            </thead>
            <tbody>
              {invoiceData.items.map((item: any, index: number) => (
                <tr key={index} className="border-b border-slate-200">
                  <td className="p-3">
                    <div className="font-medium text-slate-900">{item.product.name}</div>
                    {item.product.description && (
                      <div className="text-sm text-slate-500">{item.product.description}</div>
                    )}
                  </td>
                  <td className="text-right p-3 text-slate-700">{item.quantity}</td>
                  <td className="text-right p-3 text-slate-700">{formatINR(item.unit_price)}</td>
                  <td className="text-right p-3 text-slate-900 font-medium">{formatINR(item.total_price)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex justify-end mb-6">
            <div className="w-64">
              <div className="flex justify-between py-2 text-slate-600">
                <span>Subtotal:</span>
                <span>{formatINR(invoiceData.subtotal)}</span>
              </div>
              {invoiceData.cgst_amount > 0 && (
                <div className="flex justify-between py-2 text-slate-600">
                  <span>CGST ({invoiceData.tax_rate / 2}%):</span>
                  <span>{formatINR(invoiceData.cgst_amount)}</span>
                </div>
              )}
              {invoiceData.sgst_amount > 0 && (
                <div className="flex justify-between py-2 text-slate-600">
                  <span>SGST ({invoiceData.tax_rate / 2}%):</span>
                  <span>{formatINR(invoiceData.sgst_amount)}</span>
                </div>
              )}
              {invoiceData.igst_amount > 0 && (
                <div className="flex justify-between py-2 text-slate-600">
                  <span>IGST ({invoiceData.tax_rate}%):</span>
                  <span>{formatINR(invoiceData.igst_amount)}</span>
                </div>
              )}
              <div className="flex justify-between py-3 border-t-2 border-slate-300 font-bold text-lg text-slate-900">
                <span>Total:</span>
                <span>{formatINR(invoiceData.total_amount)}</span>
              </div>
            </div>
          </div>

          {companyProfile?.bank_name && (
            <div className="mb-6 p-4 bg-slate-50 rounded">
              <h3 className="font-semibold text-slate-900 mb-2">Banking Details</h3>
              <div className="text-sm text-slate-600 space-y-1">
                <p><span className="font-medium">Bank:</span> {companyProfile.bank_name}</p>
                {companyProfile.account_number && <p><span className="font-medium">Account Number:</span> {companyProfile.account_number}</p>}
                {companyProfile.ifsc_code && <p><span className="font-medium">IFSC Code:</span> {companyProfile.ifsc_code}</p>}
              </div>
            </div>
          )}

          {companyProfile?.terms_conditions && (
            <div className="text-sm text-slate-600 border-t pt-4">
              <p className="font-semibold mb-1">Terms & Conditions:</p>
              <p>{companyProfile.terms_conditions}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
