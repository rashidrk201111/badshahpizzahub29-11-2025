import { useEffect, useState } from 'react';
import Barcode from 'react-barcode';
import { Product } from '../../lib/supabase';
import { formatINR } from '../../lib/currency';
import { X } from 'lucide-react';

interface BarcodeLabelProps {
  products: Product[];
  onClose: () => void;
}

type LabelSize = 'small' | 'medium' | 'large';

export function BarcodeLabel({ products, onClose }: BarcodeLabelProps) {
  const [labelSize, setLabelSize] = useState<LabelSize>('medium');
  const [showPrice, setShowPrice] = useState(true);

  useEffect(() => {
    const style = document.createElement('style');
    style.innerHTML = `
      svg text {
        font-weight: 900 !important;
        font-family: 'Roboto', sans-serif !important;
      }
      @media print {
        body * {
          visibility: hidden;
        }
        #barcode-print-area, #barcode-print-area * {
          visibility: visible !important;
        }
        #barcode-print-area {
          position: absolute;
          left: 0;
          top: 0;
          width: 100%;
        }
        .print-hide {
          display: none !important;
        }
        .barcode-label {
          page-break-inside: avoid;
          break-inside: avoid;
          border: 2px solid #000 !important;
          margin-bottom: 10px;
        }
        svg {
          display: block !important;
        }
        svg text {
          font-weight: 900 !important;
        }
        @page {
          margin: 0;
          size: auto;
        }
      }
    `;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  const handlePrint = () => {
    window.print();
  };

  const getLabelConfig = () => {
    switch (labelSize) {
      case 'small':
        return {
          gridCols: 'grid-cols-2 sm:grid-cols-4 lg:grid-cols-6',
          width: '100%',
          minHeight: '160px',
          barcodeWidth: 3.5,
          barcodeHeight: 60,
          fontSize: 20,
        };
      case 'large':
        return {
          gridCols: 'grid-cols-1 sm:grid-cols-2',
          width: '100%',
          minHeight: '360px',
          barcodeWidth: 5,
          barcodeHeight: 110,
          fontSize: 28,
        };
      default:
        return {
          gridCols: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
          width: '100%',
          minHeight: '260px',
          barcodeWidth: 4.5,
          barcodeHeight: 85,
          fontSize: 24,
        };
    }
  };

  const config = getLabelConfig();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b border-slate-200 print-hide">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Print Barcode Labels</h2>
              <p className="text-sm text-slate-600 mt-1">{products.length} product(s) selected</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handlePrint}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition"
              >
                Print Labels
              </button>
              <button
                onClick={onClose}
                className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Label Size</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setLabelSize('small')}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition ${
                    labelSize === 'small'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  Small
                </button>
                <button
                  onClick={() => setLabelSize('medium')}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition ${
                    labelSize === 'medium'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  Medium
                </button>
                <button
                  onClick={() => setLabelSize('large')}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition ${
                    labelSize === 'large'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  Large
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Display Options</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showPrice}
                    onChange={(e) => setShowPrice(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-sm text-slate-700">Show Price</span>
                </label>
              </div>
            </div>
          </div>
        </div>

        <div className="overflow-y-auto p-6">
          <div id="barcode-print-area" className={`grid ${config.gridCols} gap-4`}>
            {products.map((product) => (
              <div
                key={product.id}
                className="barcode-label border-2 border-slate-300 rounded-lg p-4 bg-white"
                style={{
                  width: config.width,
                  minHeight: config.minHeight,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <div className="text-center w-full mb-2">
                  <h3
                    className="font-black text-slate-900"
                    style={{ fontSize: `${config.fontSize + 6}px`, fontWeight: 900, lineHeight: 1.2 }}
                  >
                    {product.name}
                  </h3>
                </div>

                <div className="flex justify-center my-2">
                  <Barcode
                    value={product.sku}
                    width={config.barcodeWidth}
                    height={config.barcodeHeight}
                    fontSize={config.fontSize}
                    margin={0}
                    displayValue={false}
                  />
                </div>

                <div className="text-center w-full mt-1">
                  <p
                    className="text-slate-900"
                    style={{ fontSize: `${config.fontSize + 10}px`, fontWeight: 700, fontFamily: 'Roboto, sans-serif' }}
                  >
                    {product.sku}
                  </p>
                </div>

                {product.description && labelSize !== 'small' && (
                  <div className="text-center w-full mt-2">
                    <p
                      className="text-slate-800 line-clamp-2"
                      style={{
                        fontSize: `${config.fontSize - 2}px`,
                        fontWeight: 500,
                        fontFamily: 'Roboto, sans-serif',
                        fontStyle: 'italic'
                      }}
                    >
                      {product.description}
                    </p>
                  </div>
                )}

                {showPrice && (
                  <div className="border-t border-slate-200 pt-2 mt-3 w-full">
                    <div className="flex justify-between items-center" style={{ fontSize: `${config.fontSize + 2}px` }}>
                      <span className="text-slate-900 font-black" style={{ fontWeight: 900 }}>Price:</span>
                      <span className="font-black text-slate-900" style={{ fontWeight: 900 }}>{formatINR(product.selling_price)}</span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="p-4 border-t border-slate-200 bg-slate-50 print-hide">
          <p className="text-xs text-slate-600 text-center">
            <strong>Important:</strong> In your browser's print dialog, please disable "Headers and footers" option to remove the URL and title from the printout.
          </p>
        </div>
      </div>
    </div>
  );
}
