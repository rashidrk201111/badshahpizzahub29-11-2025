import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Printer, X as XIcon, FileText, Receipt } from 'lucide-react';
import { formatINR } from '../../lib/currency';

interface InvoiceViewProps {
  invoiceId: string;
  onClose: () => void;
}

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
  logo_url: string;
}

export function InvoiceView({ invoiceId, onClose }: InvoiceViewProps) {
  const [loading, setLoading] = useState(true);
  const [invoiceData, setInvoiceData] = useState<any>(null);
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile | null>(null);
  const [printFormat, setPrintFormat] = useState<'thermal' | 'a4'>('thermal');

  useEffect(() => {
    loadInvoiceData();
  }, [invoiceId]);

  useEffect(() => {
    const style = document.createElement('style');
    style.innerHTML = `
      @media print {
        @page {
          size: 80mm auto;
          margin: 0;
        }
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
          width: 80mm;
          padding: 10px;
          margin: 0;
        }
        .print\\:hidden {
          display: none !important;
        }
        * {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
          color-adjust: exact !important;
          border-width: 1px !important;
          border-color: #000 !important;
          box-shadow: inset 0 0 0 1px #000 !important;
        }
        #invoice-content table thead th {
          border: 1px solid #000 !important;
          box-shadow: inset 0 0 0 1px #000 !important;
        }
        #invoice-content table tbody td {
          border: 1px solid #000 !important;
          box-shadow: inset 0 0 0 1px #000 !important;
        }
        ${printFormat === 'thermal' ? `
          #invoice-content {
            font-size: 11px !important;
          }
          #invoice-content h1 {
            font-size: 16px !important;
          }
          #invoice-content h2 {
            font-size: 14px !important;
          }
          #invoice-content h3 {
            font-size: 12px !important;
          }
          @page {
            size: 80mm auto;
            margin: 5mm;
          }
        ` : `
          @page {
            size: A4;
            margin: 0;
          }
        `}
      }
    `;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, [printFormat]);

  const loadInvoiceData = async () => {
    try {
      const invoiceRes = await supabase
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
        .single();

      if (invoiceRes.error) throw invoiceRes.error;

      const profileRes = await supabase
        .from('company_profile')
        .select('*')
        .maybeSingle();

      setInvoiceData(invoiceRes.data);
      setCompanyProfile(profileRes.data);
    } catch (error) {
      console.error('Error loading invoice:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl p-8">
          <div className="text-center">Loading invoice...</div>
        </div>
      </div>
    );
  }

  if (!invoiceData) {
    return null;
  }

  const { customer, items } = invoiceData;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full my-8">
        <div className="p-6 border-b-4 border-blue-600 print:hidden bg-gradient-to-r from-blue-50 to-slate-50">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-900 mb-1">Invoice Preview</h2>
              <p className="text-sm text-slate-600">Choose your print format below</p>
            </div>
            <button
              onClick={onClose}
              className="flex items-center justify-center gap-2 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-lg transition shadow-lg hover:shadow-xl"
            >
              <XIcon className="w-4 h-4 flex-shrink-0" />
              <span>Close</span>
            </button>
          </div>

          <div className="flex gap-3 mb-4">
            <button
              onClick={() => setPrintFormat('thermal')}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 font-semibold rounded-lg transition ${
                printFormat === 'thermal'
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'bg-white text-slate-700 border-2 border-slate-300 hover:border-blue-400'
              }`}
            >
              <Receipt className="w-5 h-5" />
              Thermal (80mm)
            </button>
            <button
              onClick={() => setPrintFormat('a4')}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 font-semibold rounded-lg transition ${
                printFormat === 'a4'
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'bg-white text-slate-700 border-2 border-slate-300 hover:border-blue-400'
              }`}
            >
              <FileText className="w-5 h-5" />
              A4 Format
            </button>
          </div>

          <button
            onClick={handlePrint}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-bold rounded-lg transition shadow-lg hover:shadow-xl"
          >
            <Printer className="w-5 h-5" />
            Print Invoice
          </button>
        </div>

        <div className="overflow-auto max-h-[70vh] print:max-h-none print:overflow-visible">
          <div id="invoice-content" className="bg-white">
            <div className="p-4 max-w-[80mm] mx-auto">
                <div className="text-center mb-4">
                  {companyProfile?.logo_url && (
                    <div className="flex justify-center mb-2">
                      <img
                        src={companyProfile.logo_url}
                        alt="Company Logo"
                        className="h-16 w-16 object-contain"
                      />
                    </div>
                  )}
                  <h1 className="text-2xl font-bold mb-1">
                    {companyProfile?.company_name || 'Company Name'}
                  </h1>
                  {companyProfile && (
                    <div className="text-xs text-slate-600">
                      {companyProfile.address_line1 && <p>{companyProfile.address_line1}</p>}
                      {companyProfile.phone && <p>Tel: {companyProfile.phone}</p>}
                      {companyProfile.gst_number && <p>GST: {companyProfile.gst_number}</p>}
                    </div>
                  )}
                </div>

                <div className="border-t border-b border-dashed border-slate-400 py-2 mb-2">
                  <div className="text-center font-bold text-lg">INVOICE</div>
                  <div className="text-xs">
                    <p>Invoice: #{invoiceData.invoice_number}</p>
                    <p>Date: {new Date(invoiceData.created_at).toLocaleDateString('en-IN')}</p>
                  </div>
                </div>

                <div className="text-xs mb-2">
                  <p className="font-bold mb-1">Customer:</p>
                  <p className="font-semibold">{customer?.name}</p>
                  {customer?.phone && <p>{customer.phone}</p>}
                </div>

                <table className="w-full text-xs mb-2">
                  <thead>
                    <tr className="border-b border-slate-400">
                      <th className="text-left py-1">Item</th>
                      <th className="text-center py-1">Qty</th>
                      <th className="text-right py-1">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item: any) => (
                      <tr key={item.id} className="border-b border-dashed border-slate-300">
                        <td className="py-1">{item.menu_item_name || item.product_name || item.product?.description || item.product?.name || 'N/A'}</td>
                        <td className="text-center py-1">{item.quantity}</td>
                        <td className="text-right py-1">{formatINR(item.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="text-xs space-y-1 mb-2">
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span>{formatINR(invoiceData.subtotal)}</span>
                  </div>
                  {invoiceData.tax > 0 && (
                    <div className="flex justify-between">
                      <span>Tax:</span>
                      <span>{formatINR(invoiceData.tax)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-sm border-t border-slate-400 pt-1">
                    <span>TOTAL:</span>
                    <span>{formatINR(invoiceData.total)}</span>
                  </div>
                </div>

                <div className="text-center text-xs border-t border-dashed border-slate-400 pt-2">
                  <p className="font-medium">Thank you!</p>
                </div>
              </div>
          </div>
        </div>
      </div>
    </div>
  );
}
