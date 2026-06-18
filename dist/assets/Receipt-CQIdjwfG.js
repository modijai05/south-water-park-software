import{r as p,aj as e,aC as b}from"./vendor-rs5hDOBe.js";import{m as F}from"./vendor-motion-CL12fdwO.js";const y=({data:n,onClose:N,batchData:f})=>{var u;const x=p.useRef(null),[T,A]=p.useState(!1),[h,k]=p.useState(""),d="entries"in n,s=d?null:n,a=d?n:null,m=(s==null?void 0:s.finalAmount)||((s==null?void 0:s.baseAmount)||0)-((s==null?void 0:s.kidDiscount)||0)-((s==null?void 0:s.additionalDiscount)||0),j=((s==null?void 0:s.cashAmount)||0)+((s==null?void 0:s.upiAmount)||0)+((s==null?void 0:s.advanceAmount)||0)+((s==null?void 0:s.otherAmount)||0),g=()=>{const i=x.current;if(!i)return;const t=window.open("","_blank");if(!t){alert("Please allow popups for printing");return}let o=i.innerHTML;o=o.replace(/src="[^"]*The South Water Park Logo\.png"/g,'src="/logo.png"');const c=`
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
  ${o}
  <script>
    window.onload = function() {
      setTimeout(() => {
        window.print();
        window.close();
      }, 500);
    };
  <\/script>
</body>
</html>`;t.document.write(c),t.document.close()},w=i=>i?b(new Date(i),"dd MMM yyyy, hh:mm a"):b(new Date,"dd MMM yyyy, hh:mm a"),l=i=>({150:"Regular Entry (₹150)",300:"3-4 Hours Entry (₹300)",450:"Fast Food + Entry (₹450)",600:"Full Day Entry (₹600)",100:"Kids Special (₹100)"})[i]||i;return e.jsx("div",{className:"fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4",children:e.jsxs(F.div,{initial:{opacity:0,scale:.9},animate:{opacity:1,scale:1},exit:{opacity:0,scale:.9},className:"bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto",children:[e.jsxs("div",{className:"sticky top-0 bg-white border-b p-4 flex justify-between items-center",children:[e.jsx("h3",{className:"text-lg font-bold text-gray-900",children:d?"Batch Receipts":"Receipt"}),e.jsxs("div",{className:"flex gap-2",children:[e.jsx("button",{onClick:g,className:"px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm",children:"Print"}),e.jsx("button",{onClick:N,className:"px-3 py-1 bg-gray-600 text-white rounded hover:bg-gray-700 text-sm",children:"Close"})]})]}),e.jsx("div",{ref:x,className:"p-6",children:d&&a?e.jsxs("div",{children:[e.jsxs("div",{className:"receipt-header text-center mb-4",children:[e.jsx("img",{src:"/logo.png",alt:"The South Water Park Logo",style:{width:"200px",height:"auto",marginBottom:"10px"}}),e.jsx("h1",{className:"text-lg font-bold text-blue-900",children:"THE SOUTH WATER PARK"}),e.jsx("p",{className:"text-xs text-gray-600",children:"JAIPUR | PH: 9462015450"}),a.dateRange&&e.jsx("p",{className:"text-xs text-gray-600",children:a.dateRange}),e.jsxs("p",{className:"text-xs text-gray-600",children:["ENTRIES: ",a.totalEntries," | TOTAL: ₹",a.totalRevenue]})]}),e.jsx("div",{children:a.entries.map((i,t)=>{var o,c;return e.jsxs("div",{className:"batch-entry",children:[e.jsxs("h4",{children:["Entry ",t+1]}),e.jsx("div",{className:"mt-2 mb-2 p-2 bg-blue-50 border-2 border-blue-200 rounded-lg",children:e.jsxs("div",{className:"receipt-row",children:[e.jsx("span",{className:"receipt-label font-bold text-blue-900",children:"Receipt No:"}),e.jsx("span",{className:"font-bold text-blue-900",children:i.receiptNumber||"N/A"})]})}),e.jsxs("div",{className:"receipt-row",children:[e.jsx("span",{className:"receipt-label",children:"Name:"}),e.jsx("span",{children:i.name})]}),e.jsxs("div",{className:"receipt-row",children:[e.jsx("span",{className:"receipt-label",children:"Mobile:"}),e.jsx("span",{children:i.mobile})]}),e.jsxs("div",{className:"receipt-row",children:[e.jsx("span",{className:"receipt-label",children:"Ticket Type:"}),e.jsx("span",{children:l(i.ticketType)})]}),e.jsxs("div",{className:"receipt-row",children:[e.jsx("span",{className:"receipt-label",children:"Adults:"}),e.jsx("span",{children:i.adults})]}),e.jsxs("div",{className:"receipt-row",children:[e.jsx("span",{className:"receipt-label",children:"Kids:"}),e.jsx("span",{children:i.ticketType==="150"?0:i.kids})]}),e.jsxs("div",{className:"receipt-row",children:[e.jsx("span",{className:"receipt-label",children:"Total People:"}),e.jsx("span",{children:i.totalPeople})]}),e.jsxs("div",{className:"receipt-row",children:[e.jsx("span",{className:"receipt-label",children:"Filled By:"}),e.jsx("span",{children:i.filledByFullName||i.filledBy||"Unknown"})]}),i.upgrades&&i.upgrades.length>0&&e.jsxs("div",{style:{marginTop:"8px",borderTop:"1px dashed #ccc",paddingTop:"8px"},children:[e.jsx("div",{style:{fontWeight:"bold",marginBottom:"4px",fontSize:"10px"},children:"UPGRADE TICKETS:"}),i.upgrades.map((r,v)=>e.jsxs("div",{className:"receipt-row",style:{fontSize:"10px"},children:[e.jsxs("span",{children:[l(r.ticketType),":"]}),e.jsxs("span",{children:["A: ",r.adults," | K: ",r.kids]})]},v))]}),(i.adultsFastFoodCoupon||i.kidsFastFoodCoupon||i.adultsMainFoodCoupon||i.kidsMainFoodCoupon)&&e.jsxs("div",{style:{marginTop:"8px",borderTop:"1px dashed #ccc",paddingTop:"8px"},children:[e.jsx("div",{style:{fontWeight:"bold",marginBottom:"4px",fontSize:"10px"},children:"FOOD COUPONS:"}),i.adultsFastFoodCoupon&&e.jsxs("div",{className:"receipt-row",style:{fontSize:"10px"},children:[e.jsx("span",{children:"Adults Fast Food:"}),e.jsx("span",{children:i.adultsFastFoodCoupon})]}),i.kidsFastFoodCoupon&&e.jsxs("div",{className:"receipt-row",style:{fontSize:"10px"},children:[e.jsx("span",{children:"Kids Fast Food:"}),e.jsx("span",{children:i.kidsFastFoodCoupon})]}),i.adultsMainFoodCoupon&&e.jsxs("div",{className:"receipt-row",style:{fontSize:"10px"},children:[e.jsx("span",{children:"Adults Main Food:"}),e.jsx("span",{children:i.adultsMainFoodCoupon})]}),i.kidsMainFoodCoupon&&e.jsxs("div",{className:"receipt-row",style:{fontSize:"10px"},children:[e.jsx("span",{children:"Kids Main Food:"}),e.jsx("span",{children:i.kidsMainFoodCoupon})]})]}),e.jsxs("div",{className:"receipt-row",style:{marginTop:"8px",borderTop:"1px dashed #ccc",paddingTop:"8px"},children:[e.jsx("span",{className:"receipt-label",children:"Subtotal:"}),e.jsxs("span",{children:["₹",((o=i.baseAmount)==null?void 0:o.toFixed(2))||"0.00"]})]}),i.kidDiscount&&i.kidDiscount>0&&e.jsxs("div",{className:"receipt-row",children:[e.jsx("span",{className:"receipt-label",children:"Kids Discount:"}),e.jsxs("span",{style:{color:"#ea580c"},children:["-₹",i.kidDiscount.toFixed(2)]})]}),i.additionalDiscount&&i.additionalDiscount>0&&e.jsxs("div",{className:"receipt-row",children:[e.jsx("span",{className:"receipt-label",children:"Additional Discount:"}),e.jsxs("span",{style:{color:"#dc2626"},children:["-₹",i.additionalDiscount.toFixed(2)]})]}),e.jsxs("div",{className:"receipt-row",style:{fontWeight:"bold",borderTop:"1px dashed #000",paddingTop:"3px",marginTop:"3px"},children:[e.jsx("span",{className:"receipt-label",children:"Final Amount:"}),e.jsxs("span",{children:["₹",((c=i.finalAmount)==null?void 0:c.toFixed(2))||"0.00"]})]}),i.advanceAmount>0&&e.jsxs("div",{className:"receipt-row",children:[e.jsx("span",{className:"receipt-label",children:"Advance:"}),e.jsxs("span",{children:["₹",i.advanceAmount.toFixed(2)]})]})]},t)})})]}):s?e.jsxs("div",{children:[e.jsxs("div",{className:"receipt-header text-center mb-4",children:[e.jsx("img",{src:"/logo.png",alt:"The South Water Park Logo",style:{width:"200px",height:"auto",marginBottom:"10px"}}),e.jsx("h1",{className:"text-lg font-bold text-blue-900",children:"THE SOUTH WATER PARK"}),e.jsx("p",{className:"text-xs text-gray-600",children:"JAIPUR | PH: 9462015450"}),e.jsx("p",{className:"text-xs text-gray-600",children:w(s.createdAt)}),e.jsx("div",{className:"mt-3 mb-3 p-2 bg-blue-50 border-2 border-blue-200 rounded-lg",children:e.jsxs("p",{className:"text-lg font-bold text-blue-900",children:["Receipt No: ",s.receiptNumber||"N/A"]})})]}),e.jsxs("div",{children:[e.jsxs("div",{className:"receipt-row",children:[e.jsx("span",{className:"receipt-label",children:"Name:"}),e.jsx("span",{children:s.name})]}),e.jsxs("div",{className:"receipt-row",children:[e.jsx("span",{className:"receipt-label",children:"Mobile:"}),e.jsx("span",{children:s.mobile})]}),e.jsxs("div",{className:"receipt-row",children:[e.jsx("span",{className:"receipt-label",children:"Ticket Type:"}),e.jsx("span",{children:l(s.ticketType)})]}),e.jsxs("div",{className:"receipt-row",children:[e.jsx("span",{className:"receipt-label",children:"Adults:"}),e.jsx("span",{children:s.adults})]}),e.jsxs("div",{className:"receipt-row",children:[e.jsx("span",{className:"receipt-label",children:"Kids:"}),e.jsx("span",{children:s.ticketType==="150"?0:s.kids})]}),e.jsxs("div",{className:"receipt-row",children:[e.jsx("span",{className:"receipt-label",children:"Total People:"}),e.jsx("span",{children:s.totalPeople})]}),e.jsxs("div",{className:"receipt-row",children:[e.jsx("span",{className:"receipt-label",children:"Filled By:"}),e.jsx("span",{children:s.filledByFullName||s.filledBy||"Unknown"})]})]}),s.upgrades&&s.upgrades.length>0&&e.jsxs("div",{className:"receipt-section",children:[e.jsx("h4",{children:"UPGRADE TICKETS"}),s.upgrades.map((i,t)=>e.jsx("div",{style:{marginBottom:"8px"},children:e.jsxs("div",{className:"receipt-row",children:[e.jsxs("span",{className:"receipt-label",children:[l(i.ticketType),":"]}),e.jsxs("span",{children:["Adults: ",i.adults," | Kids: ",i.kids]})]})},t))]}),(s.adultsFastFoodCoupon||s.kidsFastFoodCoupon||s.adultsMainFoodCoupon||s.kidsMainFoodCoupon)&&e.jsxs("div",{className:"receipt-section",children:[e.jsx("h4",{children:"FOOD COUPONS"}),s.adultsFastFoodCoupon&&e.jsxs("div",{className:"receipt-row",children:[e.jsx("span",{className:"receipt-label",children:"Adults Fast Food:"}),e.jsx("span",{children:s.adultsFastFoodCoupon})]}),s.kidsFastFoodCoupon&&e.jsxs("div",{className:"receipt-row",children:[e.jsx("span",{className:"receipt-label",children:"Kids Fast Food:"}),e.jsx("span",{children:s.kidsFastFoodCoupon})]}),s.adultsMainFoodCoupon&&e.jsxs("div",{className:"receipt-row",children:[e.jsx("span",{className:"receipt-label",children:"Adults Main Food:"}),e.jsx("span",{children:s.adultsMainFoodCoupon})]}),s.kidsMainFoodCoupon&&e.jsxs("div",{className:"receipt-row",children:[e.jsx("span",{className:"receipt-label",children:"Kids Main Food:"}),e.jsx("span",{children:s.kidsMainFoodCoupon})]})]}),e.jsxs("div",{className:"receipt-section",children:[e.jsx("h4",{children:"PAYMENT DETAILS"}),e.jsxs("div",{className:"receipt-row",children:[e.jsx("span",{children:"Subtotal:"}),e.jsxs("span",{children:["₹",((u=s==null?void 0:s.baseAmount)==null?void 0:u.toFixed(2))||"0.00"]})]}),s.kidDiscount&&s.kidDiscount>0&&e.jsxs("div",{className:"receipt-row",children:[e.jsx("span",{children:"Kids Discount:"}),e.jsxs("span",{style:{color:"#ea580c"},children:["-₹",s.kidDiscount.toFixed(2)]})]}),s.additionalDiscount&&s.additionalDiscount>0&&e.jsxs("div",{className:"receipt-row",children:[e.jsx("span",{children:"Additional Discount:"}),e.jsxs("span",{style:{color:"#dc2626"},children:["-₹",s.additionalDiscount.toFixed(2)]})]}),s.cashAmount>0&&e.jsxs("div",{className:"receipt-row",children:[e.jsx("span",{children:"Cash:"}),e.jsxs("span",{children:["₹",s.cashAmount.toFixed(2)]})]}),s.upiAmount>0&&e.jsxs("div",{className:"receipt-row",children:[e.jsx("span",{children:"UPI:"}),e.jsxs("span",{children:["₹",s.upiAmount.toFixed(2)]})]}),s.advanceAmount>0&&e.jsxs("div",{className:"receipt-row",children:[e.jsx("span",{children:"ADVANCE:"}),e.jsxs("span",{children:["₹",s.advanceAmount.toFixed(2)]})]}),s.otherAmount>0&&e.jsxs("div",{className:"receipt-row",children:[e.jsx("span",{children:"Other:"}),e.jsxs("span",{children:["₹",s.otherAmount.toFixed(2)]})]}),e.jsxs("div",{className:"receipt-row receipt-total",children:[e.jsx("span",{children:"TOTAL:"}),e.jsxs("span",{children:["₹",m.toFixed(2)]})]}),j!==m&&e.jsxs("div",{className:"receipt-row",style:{color:"#dc2626",fontSize:"10px"},children:[e.jsx("span",{children:"Payment Mismatch:"}),e.jsxs("span",{children:["₹",j.toFixed(2)]})]})]}),e.jsxs("div",{className:"receipt-footer",children:[e.jsx("p",{children:"THANK YOU! VISIT AGAIN"}),e.jsx("p",{children:"THE SOUTH WATER PARK | JAIPUR"}),e.jsx("p",{children:"PH: 9462015450"})]})]}):null}),h&&e.jsx("div",{className:"mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg",children:e.jsx("p",{className:"text-sm text-blue-800 font-medium",children:h})})]})})};export{y as R};
