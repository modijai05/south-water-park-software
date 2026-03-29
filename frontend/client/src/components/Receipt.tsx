import { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';

interface ReceiptData {
  receiptNumber?: string;
  name: string;
  mobile: string;
  ticketType: string;
  adults: number;
  kids: number;
  upgrades: Array<{
    ticketType: string;
    adults: number;
    kids: number;
    adultsFastFoodCoupon?: string;
    kidsFastFoodCoupon?: string;
    adultsMainFoodCoupon?: string;
    kidsMainFoodCoupon?: string;
  }>;
  baseAmount: number;
  kidDiscount: number;
  additionalDiscount: number;
  finalAmount: number;
  totalPeople: number;
  cashAmount: number;
  upiAmount: number;
  advanceAmount: number;
  otherAmount: number;
  filledBy?: string;
  filledByFullName?: string;
  createdBy?: {
    username: string;
    fullName?: string;
  };
  createdAt?: string;
  adultsFastFoodCoupon?: string;
  kidsFastFoodCoupon?: string;
  adultsMainFoodCoupon?: string;
  kidsMainFoodCoupon?: string;
}

interface BatchReceiptData {
  entries: ReceiptData[];
  dateRange: string;
  totalEntries: number;
  totalRevenue: number;
}

interface ReceiptProps {
  data: ReceiptData | BatchReceiptData;
  onClose: () => void;
  batchData?: BatchReceiptData | null;
}

const Receipt: React.FC<ReceiptProps> = ({ data, onClose, batchData }) => {
  const receiptRef = useRef<HTMLDivElement>(null);
  const [sendingSMS, setSendingSMS] = useState(false);
  const [smsStatus, setSMSStatus] = useState<string>('');

  const isBatch = 'entries' in data;
  const singleEntryData = isBatch ? null : data as ReceiptData;
  const batchEntryData = isBatch ? data as BatchReceiptData : null;

  const calculatedFinalAmount = singleEntryData?.finalAmount ||
    (singleEntryData?.baseAmount || 0) -
    (singleEntryData?.kidDiscount || 0) -
    (singleEntryData?.additionalDiscount || 0);

  // Calculate total payment breakdown for validation
  const totalPayment = (singleEntryData?.cashAmount || 0) + 
    (singleEntryData?.upiAmount || 0) + 
    (singleEntryData?.advanceAmount || 0) + 
    (singleEntryData?.otherAmount || 0);

  const handlePrint = () => {
    const printContent = receiptRef.current;
    if (!printContent) return;

    // Create a new window for printing
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow popups for printing');
      return;
    }

    // Get the HTML content and replace logo src with absolute path
    let contentHTML = printContent.innerHTML;
    contentHTML = contentHTML.replace(
      /src="[^"]*The South Water Park Logo\.png"/g,
      'src="/logo.png"'
    );
    
    // Create the print document with professional styles
    const printDocument = `
<!DOCTYPE html>
<html>
<head>
  <title>THE SOUTH WATER PARK - Receipt</title>
  <style>
    @page {
      margin: 10mm;
      size: 80mm auto;
    }
    
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: 'Courier New', monospace;
      font-size: 12px;
      line-height: 1.2;
      color: #000;
      background: white;
      width: 80mm;
      margin: 0 auto;
      padding: 5mm;
    }
    
    .receipt-header {
      text-align: center;
      margin-bottom: 10px;
      border-bottom: 2px dashed #000;
      padding-bottom: 10px;
    }
    
    .receipt-logo {
      width: 60mm;
      height: auto;
      margin-bottom: 8px;
      max-height: 25mm;
      object-fit: contain;
    }
    
    .receipt-header h1 {
      font-size: 16px;
      font-weight: bold;
      margin-bottom: 5px;
      color: #000;
    }
    
    .receipt-header p {
      font-size: 10px;
      margin: 2px 0;
      color: #000;
    }
    
    .receipt-row {
      display: flex;
      justify-content: space-between;
      margin: 3px 0;
      font-size: 11px;
    }
    
    .receipt-label {
      font-weight: bold;
    }
    
    .receipt-section {
      margin: 8px 0;
      border-top: 1px dashed #000;
      border-bottom: 1px dashed #000;
      padding: 5px 0;
    }
    
    .receipt-section h4 {
      font-size: 11px;
      font-weight: bold;
      margin-bottom: 5px;
      text-align: center;
    }
    
    .receipt-total {
      font-weight: bold;
      border-top: 1px dashed #000;
      padding-top: 3px;
      margin-top: 5px;
    }
    
    .receipt-footer {
      text-align: center;
      margin-top: 10px;
      border-top: 2px dashed #000;
      padding-top: 10px;
      font-size: 10px;
    }
    
    .batch-entry {
      margin-bottom: 15px;
      border-bottom: 1px dashed #000;
      padding-bottom: 10px;
    }
    
    .batch-entry:last-child {
      border-bottom: none;
    }
    
    .batch-entry h4 {
      font-size: 12px;
      font-weight: bold;
      margin-bottom: 5px;
    }
    
    .upgrade-section {
      margin: 5px 0;
      border-top: 1px dashed #ccc;
      padding-top: 5px;
    }
    
    .upgrade-title {
      font-weight: bold;
      font-size: 10px;
      margin-bottom: 3px;
    }
    
    .food-coupon-section {
      margin: 5px 0;
      border-top: 1px dashed #ccc;
      padding-top: 5px;
    }
    
    .food-coupon-title {
      font-weight: bold;
      font-size: 10px;
      margin-bottom: 3px;
    }
    
    @media print {
      body {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      
      .no-print {
        display: none !important;
      }
    }
  </style>
</head>
<body>
  ${contentHTML}
  <script>
    window.onload = function() {
      setTimeout(() => {
        window.print();
        window.close();
      }, 500);
    };
  </script>
</body>
</html>`;

    // Write the content to the new window
    printWindow.document.write(printDocument);
    printWindow.document.close();
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return format(new Date(), 'dd MMM yyyy, hh:mm a');
    return format(new Date(dateString), 'dd MMM yyyy, hh:mm a');
  };

  const getTicketTypeName = (type: string) => {
    const ticketNames: { [key: string]: string } = {
      '150': 'Regular Entry (₹150)',
      '300': '3-4 Hours Entry (₹300)',
      '450': 'Fast Food + Entry (₹450)',
      '600': 'Full Day Entry (₹600)',
      '100': 'Kids Special (₹100)'
    };
    return ticketNames[type] || type;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
      >
        <div className="sticky top-0 bg-white border-b p-4 flex justify-between items-center">
          <h3 className="text-lg font-bold text-gray-900">
            {isBatch ? 'Batch Receipts' : 'Receipt'}
          </h3>
          <div className="flex gap-2">
            <button
              onClick={handlePrint}
              className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
            >
              Print
            </button>
            <button
              onClick={onClose}
              className="px-3 py-1 bg-gray-600 text-white rounded hover:bg-gray-700 text-sm"
            >
              Close
            </button>
          </div>
        </div>

        <div ref={receiptRef} className="p-6">
          {isBatch && batchEntryData ? (
            <div>
              <div className="receipt-header text-center mb-4">
                <img src="/logo.png" alt="The South Water Park Logo" style={{width: '200px', height: 'auto', marginBottom: '10px'}} />
                <h1 className="text-lg font-bold text-blue-900">THE SOUTH WATER PARK</h1>
                <p className="text-xs text-gray-600">JAIPUR | PH: 9462015450</p>
                {batchEntryData.dateRange && <p className="text-xs text-gray-600">{batchEntryData.dateRange}</p>}
                <p className="text-xs text-gray-600">ENTRIES: {batchEntryData.totalEntries} | TOTAL: ₹{batchEntryData.totalRevenue}</p>
              </div>
              <div>
                {batchEntryData.entries.map((entry, index) => (
                  <div key={index} className="batch-entry">
                    <h4>Entry {index + 1}</h4>
                    <div className="mt-2 mb-2 p-2 bg-blue-50 border-2 border-blue-200 rounded-lg">
                      <div className="receipt-row">
                        <span className="receipt-label font-bold text-blue-900">Receipt No:</span>
                        <span className="font-bold text-blue-900">{entry.receiptNumber || 'N/A'}</span>
                      </div>
                    </div>
                    <div className="receipt-row">
                      <span className="receipt-label">Name:</span>
                      <span>{entry.name}</span>
                    </div>
                    <div className="receipt-row">
                      <span className="receipt-label">Mobile:</span>
                      <span>{entry.mobile}</span>
                    </div>
                    <div className="receipt-row">
                      <span className="receipt-label">Ticket Type:</span>
                      <span>{getTicketTypeName(entry.ticketType)}</span>
                    </div>
                    <div className="receipt-row">
                      <span className="receipt-label">Adults:</span>
                      <span>{entry.adults}</span>
                    </div>
                    <div className="receipt-row">
                      <span className="receipt-label">Kids:</span>
                      <span>{entry.ticketType === '150' ? 0 : entry.kids}</span>
                    </div>
                    <div className="receipt-row">
                      <span className="receipt-label">Total People:</span>
                      <span>{entry.totalPeople}</span>
                    </div>
                    <div className="receipt-row">
                      <span className="receipt-label">Filled By:</span>
                      <span>{entry.filledByFullName || entry.filledBy || 'Unknown'}</span>
                    </div>
                    
                    {/* Upgrade Tickets for Batch Entry */}
                    {entry.upgrades && entry.upgrades.length > 0 && (
                      <div style={{marginTop: '8px', borderTop: '1px dashed #ccc', paddingTop: '8px'}}>
                        <div style={{fontWeight: 'bold', marginBottom: '4px', fontSize: '10px'}}>UPGRADE TICKETS:</div>
                        {entry.upgrades.map((upgrade, upgradeIndex) => (
                          <div key={upgradeIndex} className="receipt-row" style={{fontSize: '10px'}}>
                            <span>{getTicketTypeName(upgrade.ticketType)}:</span>
                            <span>A: {upgrade.adults} | K: {upgrade.kids}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {/* Food Coupons for Batch Entry */}
                    {(entry.adultsFastFoodCoupon || entry.kidsFastFoodCoupon || 
                      entry.adultsMainFoodCoupon || entry.kidsMainFoodCoupon) && (
                      <div style={{marginTop: '8px', borderTop: '1px dashed #ccc', paddingTop: '8px'}}>
                        <div style={{fontWeight: 'bold', marginBottom: '4px', fontSize: '10px'}}>FOOD COUPONS:</div>
                        {entry.adultsFastFoodCoupon && (
                          <div className="receipt-row" style={{fontSize: '10px'}}>
                            <span>Adults Fast Food:</span>
                            <span>{entry.adultsFastFoodCoupon}</span>
                          </div>
                        )}
                        {entry.kidsFastFoodCoupon && (
                          <div className="receipt-row" style={{fontSize: '10px'}}>
                            <span>Kids Fast Food:</span>
                            <span>{entry.kidsFastFoodCoupon}</span>
                          </div>
                        )}
                        {entry.adultsMainFoodCoupon && (
                          <div className="receipt-row" style={{fontSize: '10px'}}>
                            <span>Adults Main Food:</span>
                            <span>{entry.adultsMainFoodCoupon}</span>
                          </div>
                        )}
                        {entry.kidsMainFoodCoupon && (
                          <div className="receipt-row" style={{fontSize: '10px'}}>
                            <span>Kids Main Food:</span>
                            <span>{entry.kidsMainFoodCoupon}</span>
                          </div>
                        )}
                      </div>
                    )}
                    
                    <div className="receipt-row" style={{marginTop: '8px', borderTop: '1px dashed #ccc', paddingTop: '8px'}}>
                      <span className="receipt-label">Subtotal:</span>
                      <span>₹{entry.baseAmount?.toFixed(2) || '0.00'}</span>
                    </div>
                    {entry.kidDiscount && entry.kidDiscount > 0 && (
                      <div className="receipt-row">
                        <span className="receipt-label">Kids Discount:</span>
                        <span style={{color: '#ea580c'}}>-₹{entry.kidDiscount.toFixed(2)}</span>
                      </div>
                    )}
                    {entry.additionalDiscount && entry.additionalDiscount > 0 && (
                      <div className="receipt-row">
                        <span className="receipt-label">Additional Discount:</span>
                        <span style={{color: '#dc2626'}}>-₹{entry.additionalDiscount.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="receipt-row" style={{fontWeight: 'bold', borderTop: '1px dashed #000', paddingTop: '3px', marginTop: '3px'}}>
                      <span className="receipt-label">Final Amount:</span>
                      <span>₹{entry.finalAmount?.toFixed(2) || '0.00'}</span>
                    </div>
                    {entry.advanceAmount > 0 && (
                      <div className="receipt-row">
                        <span className="receipt-label">Advance:</span>
                        <span>₹{entry.advanceAmount.toFixed(2)}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : singleEntryData ? (
            <div>
              <div className="receipt-header text-center mb-4">
                <img src="/logo.png" alt="The South Water Park Logo" style={{width: '200px', height: 'auto', marginBottom: '10px'}} />
                <h1 className="text-lg font-bold text-blue-900">THE SOUTH WATER PARK</h1>
                <p className="text-xs text-gray-600">JAIPUR | PH: 9462015450</p>
                <p className="text-xs text-gray-600">{formatDate(singleEntryData.createdAt)}</p>
                <div className="mt-3 mb-3 p-2 bg-blue-50 border-2 border-blue-200 rounded-lg">
                  <p className="text-lg font-bold text-blue-900">Receipt No: {singleEntryData.receiptNumber || 'N/A'}</p>
                </div>
              </div>
              
              <div>
                <div className="receipt-row">
                  <span className="receipt-label">Name:</span>
                  <span>{singleEntryData.name}</span>
                </div>
                <div className="receipt-row">
                  <span className="receipt-label">Mobile:</span>
                  <span>{singleEntryData.mobile}</span>
                </div>
                <div className="receipt-row">
                  <span className="receipt-label">Ticket Type:</span>
                  <span>{getTicketTypeName(singleEntryData.ticketType)}</span>
                </div>
                <div className="receipt-row">
                  <span className="receipt-label">Adults:</span>
                  <span>{singleEntryData.adults}</span>
                </div>
                <div className="receipt-row">
                  <span className="receipt-label">Kids:</span>
                  <span>{singleEntryData.ticketType === '150' ? 0 : singleEntryData.kids}</span>
                </div>
                <div className="receipt-row">
                  <span className="receipt-label">Total People:</span>
                  <span>{singleEntryData.totalPeople}</span>
                </div>
                <div className="receipt-row">
                  <span className="receipt-label">Filled By:</span>
                  <span>{singleEntryData.filledByFullName || singleEntryData.filledBy || 'Unknown'}</span>
                </div>
              </div>

              {/* Upgrade Tickets Section */}
              {singleEntryData.upgrades && singleEntryData.upgrades.length > 0 && (
                <div className="receipt-section">
                  <h4>UPGRADE TICKETS</h4>
                  {singleEntryData.upgrades.map((upgrade, index) => (
                    <div key={index} style={{marginBottom: '8px'}}>
                      <div className="receipt-row">
                        <span className="receipt-label">{getTicketTypeName(upgrade.ticketType)}:</span>
                        <span>Adults: {upgrade.adults} | Kids: {upgrade.kids}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Food Coupons Section */}
              {(singleEntryData.adultsFastFoodCoupon || singleEntryData.kidsFastFoodCoupon || 
                singleEntryData.adultsMainFoodCoupon || singleEntryData.kidsMainFoodCoupon) && (
                <div className="receipt-section">
                  <h4>FOOD COUPONS</h4>
                  {singleEntryData.adultsFastFoodCoupon && (
                    <div className="receipt-row">
                      <span className="receipt-label">Adults Fast Food:</span>
                      <span>{singleEntryData.adultsFastFoodCoupon}</span>
                    </div>
                  )}
                  {singleEntryData.kidsFastFoodCoupon && (
                    <div className="receipt-row">
                      <span className="receipt-label">Kids Fast Food:</span>
                      <span>{singleEntryData.kidsFastFoodCoupon}</span>
                    </div>
                  )}
                  {singleEntryData.adultsMainFoodCoupon && (
                    <div className="receipt-row">
                      <span className="receipt-label">Adults Main Food:</span>
                      <span>{singleEntryData.adultsMainFoodCoupon}</span>
                    </div>
                  )}
                  {singleEntryData.kidsMainFoodCoupon && (
                    <div className="receipt-row">
                      <span className="receipt-label">Kids Main Food:</span>
                      <span>{singleEntryData.kidsMainFoodCoupon}</span>
                    </div>
                  )}
                </div>
              )}

              <div className="receipt-section">
                <h4>PAYMENT DETAILS</h4>
                <div className="receipt-row">
                  <span>Subtotal:</span>
                  <span>₹{singleEntryData?.baseAmount?.toFixed(2) || '0.00'}</span>
                </div>
                {singleEntryData.kidDiscount && singleEntryData.kidDiscount > 0 && (
                  <div className="receipt-row">
                    <span>Kids Discount:</span>
                    <span style={{color: '#ea580c'}}>-₹{singleEntryData.kidDiscount.toFixed(2)}</span>
                  </div>
                )}
                {singleEntryData.additionalDiscount && singleEntryData.additionalDiscount > 0 && (
                  <div className="receipt-row">
                    <span>Additional Discount:</span>
                    <span style={{color: '#dc2626'}}>-₹{singleEntryData.additionalDiscount.toFixed(2)}</span>
                  </div>
                )}
                {singleEntryData.cashAmount > 0 && (
                  <div className="receipt-row">
                    <span>Cash:</span>
                    <span>₹{singleEntryData.cashAmount.toFixed(2)}</span>
                  </div>
                )}
                {singleEntryData.upiAmount > 0 && (
                  <div className="receipt-row">
                    <span>UPI:</span>
                    <span>₹{singleEntryData.upiAmount.toFixed(2)}</span>
                  </div>
                )}
                {singleEntryData.advanceAmount > 0 && (
                  <div className="receipt-row">
                    <span>ADVANCE:</span>
                    <span>₹{singleEntryData.advanceAmount.toFixed(2)}</span>
                  </div>
                )}
                {singleEntryData.otherAmount > 0 && (
                  <div className="receipt-row">
                    <span>Other:</span>
                    <span>₹{singleEntryData.otherAmount.toFixed(2)}</span>
                  </div>
                )}
                <div className="receipt-row receipt-total">
                  <span>TOTAL:</span>
                  <span>₹{calculatedFinalAmount.toFixed(2)}</span>
                </div>
                {totalPayment !== calculatedFinalAmount && (
                  <div className="receipt-row" style={{color: '#dc2626', fontSize: '10px'}}>
                    <span>Payment Mismatch:</span>
                    <span>₹{totalPayment.toFixed(2)}</span>
                  </div>
                )}
              </div>

              <div className="receipt-footer">
                <p>THANK YOU! VISIT AGAIN</p>
                <p>THE SOUTH WATER PARK | JAIPUR</p>
                <p>PH: 9462015450</p>
              </div>
            </div>
          ) : null}
        </div>
        
        {smsStatus && (
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800 font-medium">{smsStatus}</p>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default Receipt;
