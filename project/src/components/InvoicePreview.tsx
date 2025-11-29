import React, { useEffect, useState } from 'react';
import { X, Printer } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface InvoiceItem {
  menu_item_id: string;
  menu_item_name: string;
  quantity: number;
  unit_price: number;
  total: number;
}

interface InvoicePreviewProps {
  invoice: {
    id: string;
    invoice_number: string;
    customer_name: string;
    customer_phone?: string;
    table_number?: string;
    order_type: 'dine_in' | 'delivery' | 'take_away';
    subtotal: number;
    tax: number;
    total: number;
    created_at: string;
  };
  items: InvoiceItem[];
  onClose: () => void;
}

export const InvoicePreview: React.FC<InvoicePreviewProps> = ({ invoice, items, onClose }) => {
  const [companyProfile, setCompanyProfile] = useState<any>(null);

  useEffect(() => {
    loadCompanyProfile();
  }, []);

  const loadCompanyProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('company_profile')
        .select('*')
        .maybeSingle();

      if (error) throw error;
      setCompanyProfile(data);
    } catch (error) {
      console.error('Error loading company profile:', error);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const orderTypeLabels = {
    dine_in: 'DINE IN',
    delivery: 'DELIVERY',
    take_away: 'TAKE AWAY'
  };

  const orderTypeColors = {
    dine_in: '#10b981',
    delivery: '#f59e0b',
    take_away: '#3b82f6'
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full my-8" key={invoice.id}>
        <div className="flex justify-between items-center p-6 border-b border-slate-200 print:hidden">
          <h2 className="text-2xl font-bold text-slate-900">Invoice Preview</h2>
          <div className="flex gap-2">
            <button
              onClick={handlePrint}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
            >
              <Printer size={18} /> Print
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-200 text-slate-900 rounded-lg hover:bg-slate-300 flex items-center gap-2"
            >
              <X size={18} /> Close
            </button>
          </div>
        </div>

        <div className="overflow-auto max-h-[70vh] print:max-h-none print:overflow-visible">
          <div
            id="invoice-content"
            className="p-8 print:p-0"
            style={{
              fontFamily: "'Courier New', monospace",
              maxWidth: '80mm',
              margin: '0 auto',
              fontSize: '12px',
              lineHeight: '1.4'
            }}
          >
            {/* Header */}
            <div style={{
              textAlign: 'center',
              marginBottom: '10px',
              paddingBottom: '10px',
              borderBottom: '2px solid #000'
            }}>
              <h1 style={{ fontSize: '18px', marginBottom: '5px', fontWeight: 'bold' }}>
                {companyProfile?.company_name || 'Restaurant'}
              </h1>
              {companyProfile && (
                <div style={{ fontSize: '10px' }}>
                  {companyProfile.address_line1 && <div>{companyProfile.address_line1}</div>}
                  {companyProfile.phone && <div>Tel: {companyProfile.phone}</div>}
                  {companyProfile.gst_number && <div>GST: {companyProfile.gst_number}</div>}
                </div>
              )}
              <div style={{ fontSize: '16px', fontWeight: 'bold', marginTop: '8px' }}>ORDER RECEIPT</div>
              <div
                style={{
                  display: 'inline-block',
                  padding: '6px 12px',
                  margin: '8px 0',
                  borderRadius: '4px',
                  fontWeight: 'bold',
                  fontSize: '14px',
                  color: 'white',
                  backgroundColor: orderTypeColors[invoice.order_type]
                }}
              >
                {orderTypeLabels[invoice.order_type]}
              </div>
            </div>

            {/* Info */}
            <div style={{
              marginBottom: '10px',
              paddingBottom: '10px',
              borderBottom: '1px dashed #000',
              fontSize: '11px'
            }}>
              <div style={{ marginBottom: '3px' }}>
                <span style={{ fontWeight: 'bold', display: 'inline-block', width: '80px' }}>Order:</span>
                {invoice.invoice_number || 'N/A'}
              </div>
              <div style={{ marginBottom: '3px' }}>
                <span style={{ fontWeight: 'bold', display: 'inline-block', width: '80px' }}>Date:</span>
                {new Date(invoice.created_at).toLocaleDateString('en-IN')}
              </div>
              <div style={{ marginBottom: '3px' }}>
                <span style={{ fontWeight: 'bold', display: 'inline-block', width: '80px' }}>Time:</span>
                {new Date(invoice.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
              </div>
              {invoice.order_type === 'dine_in' && invoice.table_number && (
                <div style={{ marginBottom: '3px' }}>
                  <span style={{ fontWeight: 'bold', display: 'inline-block', width: '80px' }}>Table:</span>
                  {invoice.table_number}
                </div>
              )}
              {invoice.customer_name && (
                <div style={{ marginBottom: '3px' }}>
                  <span style={{ fontWeight: 'bold', display: 'inline-block', width: '80px' }}>Customer:</span>
                  {invoice.customer_name}
                </div>
              )}
              {invoice.customer_phone && (
                <div style={{ marginBottom: '3px' }}>
                  <span style={{ fontWeight: 'bold', display: 'inline-block', width: '80px' }}>Phone:</span>
                  {invoice.customer_phone}
                </div>
              )}
            </div>

            {/* Items Table */}
            <table style={{ width: '100%', marginBottom: '10px', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #000' }}>
                  <th style={{ textAlign: 'left', padding: '5px 0', fontSize: '11px' }}>Item</th>
                  <th style={{ textAlign: 'center', padding: '5px 0', fontSize: '11px', width: '30px' }}>Qty</th>
                  <th style={{ textAlign: 'right', padding: '5px 0', fontSize: '11px', width: '60px' }}>Price</th>
                  <th style={{ textAlign: 'right', padding: '5px 0', fontSize: '11px', width: '60px' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => (
                  <tr key={index} style={{ borderBottom: '1px dashed #ddd' }}>
                    <td style={{ padding: '5px 0', fontSize: '11px', fontWeight: 'bold' }}>
                      {item.menu_item_name}
                    </td>
                    <td style={{ padding: '5px 0', fontSize: '11px', textAlign: 'center' }}>
                      {item.quantity}
                    </td>
                    <td style={{ padding: '5px 0', fontSize: '11px', textAlign: 'right' }}>
                      ₹{parseFloat(String(item.unit_price)).toFixed(2)}
                    </td>
                    <td style={{ padding: '5px 0', fontSize: '11px', textAlign: 'right' }}>
                      ₹{(parseFloat(String(item.quantity)) * parseFloat(String(item.unit_price))).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Totals */}
            <div style={{
              marginTop: '10px',
              paddingTop: '10px',
              borderTop: '1px solid #000'
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: '5px',
                fontSize: '11px'
              }}>
                <span>Subtotal:</span>
                <span>₹{invoice.subtotal.toFixed(2)}</span>
              </div>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: '5px',
                fontSize: '11px'
              }}>
                <span>Tax (5%):</span>
                <span>₹{invoice.tax.toFixed(2)}</span>
              </div>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '14px',
                fontWeight: 'bold',
                paddingTop: '5px',
                borderTop: '2px solid #000'
              }}>
                <span>TOTAL:</span>
                <span>₹{invoice.total.toFixed(2)}</span>
              </div>
            </div>

            {/* Footer */}
            <div style={{
              textAlign: 'center',
              marginTop: '15px',
              paddingTop: '10px',
              borderTop: '1px dashed #000',
              fontSize: '11px'
            }}>
              <div style={{ fontWeight: 'bold', fontSize: '14px', marginBottom: '5px' }}>Thank You!</div>
              <div>Please visit again</div>
              {companyProfile?.website && <div>{companyProfile.website}</div>}
            </div>

            {/* Timestamp */}
            <div style={{
              textAlign: 'center',
              fontSize: '10px',
              marginTop: '10px',
              color: '#666'
            }}>
              Printed: {new Date().toLocaleString('en-IN')}
            </div>
          </div>
        </div>
      </div>

      <style>
        {`
          @media print {
            body {
              margin: 0;
              padding: 0;
            }
            @page {
              size: 80mm auto;
              margin: 0;
            }
            #invoice-content {
              padding: 5mm !important;
            }
          }
        `}
      </style>
    </div>
  );
};

export default InvoicePreview;
