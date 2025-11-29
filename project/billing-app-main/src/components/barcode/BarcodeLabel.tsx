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
      .react-barcode-wrapper text {
        font-weight: bold !important;
        fill: #000 !important;
        font-size: 12px !important;
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
        @page {
          margin: 0;
          size: auto;
        }
        .react-barcode-wrapper text {
          font-weight: bold !important;
          fill: #000 !important;
          font-size: 12px !important;
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
          minHeight: '120px',
          barcodeWidth: 1.2,
          barcodeHeight: 35,
          fontSize: 10,
        };
      case 'large':
        return {
          gridCols: 'grid-cols-1 sm:grid-cols-2',
          width: '100%',
          minHeight: '280px',
          barcodeWidth: 2,
          barcodeHeight: 70,
          fontSize: 14,
        };
      default:
        return {
          gridCols: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
          width: '100%',
          minHeight: '200px',
          barcodeWidth: 1.5,
          barcodeHeight: 50,
          fontSize: 12,
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
                className="barcode-label border-2 border-slate-300 rounded-lg p-3 bg-white"
                style={{
                  width: config.width,
                  minHeight: config.minHeight,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between'
                }}
              >
                <div className="text-center mb-2">
                  <h3
                    className="font-bold text-slate-900 mb-1 line-clamp-2"
                    style={{ fontSize: `${config.fontSize + 2}px` }}
                  >
                    {product.name}
                  </h3>
                  {product.color && (
                    <p
                      className="text-slate-900 font-bold"
                      style={{ fontSize: `${config.fontSize}px` }}
                    >
                      Color: {product.color}
                    </p>
                  )}
                  {product.description && labelSize !== 'small' && (
                    <p
                      className="text-slate-900 font-medium"
                      style={{ fontSize: `${config.fontSize - 2}px` }}
                    >
                      {product.description}
                    </p>
                  )}
                </div>

                <div className="flex justify-center my-2">
                  <div className="react-barcode-wrapper">
                    <Barcode
                      value={product.sku}
                      width={config.barcodeWidth}
                      height={config.barcodeHeight}
                      fontSize={config.fontSize}
                      textAlign="center"
                      margin={0}
                      displayValue={true}
                    />
                  </div>
                </div>

                {showPrice && (
                  <div className="border-t border-slate-200 pt-2 mt-2">
                    <div className="flex justify-between items-center" style={{ fontSize: `${config.fontSize}px` }}>
                      <span className="text-slate-600">Price:</span>
                      <span className="font-bold text-slate-900">{formatINR(product.selling_price)}</span>
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
