import { useState, useMemo, useEffect } from 'react';

import { useNavigate } from 'react-router-dom';

import { motion } from 'framer-motion';

import { useForm } from 'react-hook-form';

import { z } from 'zod';

import { zodResolver } from '@hookform/resolvers/zod';

import { Layout } from '@/components/Layout';

import { useAuthStore } from '@/store/authStore';

import { useEntryStore } from '@/store/entryStore';

import { entriesApi } from '@/lib/api';

import { computeAmounts, computeAmountsSync, isSunday, invalidateTicketConfigCache, getTicketPrice, TICKET_OPTIONS } from '@/lib/ticketUtils';

import dayjs from 'dayjs';

import Receipt from '@/components/Receipt';



const paymentSchema = z.object({

  cashAmount: z.number().min(0, 'Cash amount is required'),

  upiAmount: z.number().min(0, 'UPI amount is required'),

  advanceAmount: z.number().min(0, 'Advance amount is required'),

  additionalDiscount: z.number().min(0, 'Additional discount must be 0 or more'),

  notes: z.string().optional(),

}).refine(

  (data) => {

    const total = data.cashAmount + data.upiAmount + data.advanceAmount;

    return total > 0;

  },

  { message: 'At least one payment amount is required', path: ['cashAmount'] }

);



type PaymentFormData = z.infer<typeof paymentSchema>;



interface MoneyStats {

  todayEntries: number;

  todayPeople: number;

  todayRevenue: number;

  todayCash: number;

  todayUPI: number;

  pendingPayments: number;

  weeklyRevenue: number;

  monthlyRevenue: number;

  peakHour: string;

  conversionRate: number;

}



export function Payment() {

  const navigate = useNavigate();

  const { user } = useAuthStore();

  const { formData, clear, clearFoodCoupons } = useEntryStore();

  const [submitError, setSubmitError] = useState('');

  const [showConfirmation, setShowConfirmation] = useState(false);

  const [countdown, setCountdown] = useState(3);

  const [showSuccess, setShowSuccess] = useState(false);

  const [showReceipt, setShowReceipt] = useState(false);

  const [receiptData, setReceiptData] = useState<any>(null);

  const [moneyStats, setMoneyStats] = useState<MoneyStats>({
    todayEntries: 0,
    todayPeople: 0,
    todayRevenue: 0,
    todayCash: 0,
    todayUPI: 0,
    pendingPayments: 0,
    weeklyRevenue: 0,
    monthlyRevenue: 0,
    peakHour: 'N/A',
    conversionRate: 0,
  });

  const [loadingStats, setLoadingStats] = useState(true);

  // State for dynamic pricing
  const [amounts, setAmounts] = useState<{ baseAmount: number; kidDiscount: number; totalPeople: number; finalAmount: number } | null>(null);
  const [loadingPrices, setLoadingPrices] = useState(false);
  const [dynamicTicketPrices, setDynamicTicketPrices] = useState<Record<string, number>>({});
  const [mainSubtotal, setMainSubtotal] = useState(0);
  const [upgradeSubtotals, setUpgradeSubtotals] = useState<number[]>([]);

  

  // Form state

  const {

    register,

    watch,

    handleSubmit,

    setValue,

    formState: { errors, isSubmitting },

  } = useForm<PaymentFormData>({

    resolver: zodResolver(paymentSchema),

    defaultValues: {

      cashAmount: 0,

      upiAmount: 0,

      advanceAmount: 0,

      additionalDiscount: formData?.additionalDiscount || 0,

      notes: '',

    },

  });



  const watchedValues = watch();

  const { cashAmount, upiAmount, advanceAmount, additionalDiscount } = watchedValues;



  // Update payment form when formData changes (for data persistence)

  useEffect(() => {

    if (formData) {

      const currentValues = watchedValues;

      // Only update if different to avoid infinite loops

      if (currentValues.additionalDiscount !== formData.additionalDiscount) {

        // Update the additional discount field

        const input = document.querySelector('input[name="additionalDiscount"]');

        if (input) {

          (input as HTMLInputElement).value = String(formData.additionalDiscount || 0);

        }

      }

    }

  }, [formData]);



  // Fetch money statistics

  useEffect(() => {

    const fetchMoneyStats = async () => {

      try {

        setLoadingStats(true);

        const today = dayjs().format('YYYY-MM-DD');

        const weekStart = dayjs().subtract(7, 'day').format('YYYY-MM-DD');

        const monthStart = dayjs().subtract(30, 'day').format('YYYY-MM-DD');



        // Fetch today's entries

        const todayRes = await entriesApi.list({

          from: `${today}T00:00:00.000Z`,

          to: `${today}T23:59:59.999Z`,

          limit: 1000,

        });



        // Fetch weekly entries

        const weekRes = await entriesApi.list({

          from: `${weekStart}T00:00:00.000Z`,

          to: `${today}T23:59:59.999Z`,

          limit: 1000,

        });



        // Fetch monthly entries

        const monthRes = await entriesApi.list({

          from: `${monthStart}T00:00:00.000Z`,

          to: `${today}T23:59:59.999Z`,

          limit: 1000,

        });



        const todayEntries = todayRes.data?.entries as any[] || [];

        const weekEntries = weekRes.data?.entries as any[] || [];

        const monthEntries = monthRes.data?.entries as any[] || [];



        const todayRevenue = todayEntries.reduce((sum, e) => sum + (e.finalAmount || 0), 0);

        const todayCash = todayEntries.reduce((sum, e) => sum + (e.cashAmount || 0), 0);

        const todayUPI = todayEntries.reduce((sum, e) => sum + (e.upiAmount || 0), 0);

        const weeklyRevenue = weekEntries.reduce((sum, e) => sum + (e.finalAmount || 0), 0);

        const monthlyRevenue = monthEntries.reduce((sum, e) => sum + (e.finalAmount || 0), 0);



        const todayEntriesCount = todayEntries.length;

        const todayPeopleCount = todayEntries.reduce((sum, e) => sum + (e.totalPeople || 0), 0);



        setMoneyStats({

          todayEntries: todayEntriesCount,

          todayPeople: todayPeopleCount,

          todayRevenue,

          todayCash,

          todayUPI,

          pendingPayments: 0, // This would come from your pending payments logic

          weeklyRevenue,

          monthlyRevenue,

          peakHour: '12:00', // Default peak hour

          conversionRate: 0.95, // Default conversion rate

        });

      } catch (error) {

        console.error('Failed to fetch money stats:', error);

      } finally {

        setLoadingStats(false);

      }

    };



    fetchMoneyStats();

  }, []);



  // Fetch dynamic ticket prices
  useEffect(() => {
    const fetchTicketPrices = async () => {
      if (!formData) return;
      
      const prices: Record<string, number> = {};
      const subtotals: number[] = [];
      
      // Fetch main ticket price and calculate subtotal
      try {
        const mainPrice = await getTicketPrice(formData.ticketType);
        prices.main = mainPrice;
        
        // Calculate main ticket subtotal (adults + kids * mainPrice)
        const mainTicketOption = TICKET_OPTIONS.find(t => t.value === formData.ticketType);
        const mainHasKids = mainTicketOption?.hasKids ?? true;
        const mainSubtotalAmount = formData.adults * mainPrice + (mainHasKids ? formData.kids * mainPrice : 0);
        setMainSubtotal(mainSubtotalAmount);
      } catch (error) {
        console.error('Error fetching main ticket price:', error);
      }
      
      // Fetch upgrade ticket prices and calculate subtotals
      if (formData.upgrades && formData.upgrades.length > 0) {
        for (let i = 0; i < formData.upgrades.length; i++) {
          try {
            const upgradePrice = await getTicketPrice(formData.upgrades[i].ticketType);
            prices[`upgrade_${i}`] = upgradePrice;
            
            // Calculate upgrade subtotal
            const upgradeSubtotalAmount = formData.upgrades[i].adults * upgradePrice + formData.upgrades[i].kids * upgradePrice;
            subtotals.push(upgradeSubtotalAmount);
          } catch (error) {
            console.error(`Error fetching upgrade ${i} ticket price:`, error);
            subtotals.push(0);
          }
        }
      }
      
      setDynamicTicketPrices(prices);
      setUpgradeSubtotals(subtotals);
    };

    fetchTicketPrices();
  }, [formData]);

  // Calculate amounts based on ticket selection using dynamic pricing
  useEffect(() => {
    const calculateDynamicAmounts = async () => {
      if (!formData) return;
      
      // Invalidate cache to ensure fresh prices
      invalidateTicketConfigCache();
      
      setLoadingPrices(true);
      try {
        const result = await computeAmounts(
          formData.ticketType,
          formData.adults,
          formData.kids,
          formData.upgrades ?? [],
          additionalDiscount
        );
        setAmounts(result);
      } catch (error) {
        console.error('Error calculating dynamic amounts:', error);
        // Fallback to sync calculation if async fails
        const fallbackResult = computeAmountsSync(
          formData.ticketType,
          formData.adults,
          formData.kids,
          formData.upgrades ?? [],
          additionalDiscount
        );
        setAmounts(fallbackResult);
      } finally {
        setLoadingPrices(false);
      }
    };

    calculateDynamicAmounts();
  }, [formData, additionalDiscount]);



  const baseAmount = amounts?.baseAmount ?? 0;

  const kidDiscount = amounts?.kidDiscount ?? 0;

  const finalAmount = amounts?.finalAmount ?? 0;

  const totalPeople = amounts?.totalPeople ?? 0;



  // Payment validation

  const totalPayment = cashAmount + upiAmount + advanceAmount;

  // Enhanced payment validation
  const isPaymentValid = finalAmount > 0 && totalPayment === finalAmount && cashAmount >= 0 && upiAmount >= 0 && advanceAmount >= 0;



  // Redirect if no form data

  if (!formData) {

    navigate('/ticket');

    return null;

  }



  const handleBackToTicket = () => {

    clearFoodCoupons();

    navigate('/ticket');

  };



  const onSubmit = async (data: PaymentFormData) => {

    setSubmitError('');

    

    if (!isPaymentValid) {

      setSubmitError(`Payment amounts must equal final amount (₹${finalAmount})`);

      return;

    }



    try {

      const payload = {

        ...formData,

        filledBy: user?.username || 'Unknown',

        filledByFullName: user?.fullName || user?.username || 'Unknown',

        totalPeople,

        baseAmount,

        kidDiscount,

        additionalDiscount,

        finalAmount: finalAmount,

        cashAmount: data.cashAmount,

        upiAmount: data.upiAmount,

        advanceAmount: data.advanceAmount,

        otherAmount: 0,

        notes: data.notes?.trim(),

      };

      console.log('Sending payload:', payload);

      const result = await entriesApi.create(payload) as any;

      console.log('Entry created successfully:', result);

      

      // Show immediate success notification

      const successToast = document.createElement('div');

      successToast.className = 'fixed top-4 right-4 bg-green-500 text-white px-6 py-4 rounded-lg shadow-lg z-50 flex items-center gap-3 transform translate-x-full transition-transform duration-300';

      successToast.innerHTML = `

        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">

          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />

        </svg>

        <div>

          <div class="font-bold">Entry Saved Successfully!</div>

          <div class="text-sm opacity-90">Ticket entry has been recorded</div>

        </div>

      `;

      document.body.appendChild(successToast);

      

      // Animate in with CSS transitions for better performance
      successToast.classList.add('animate-slide-in');
      setTimeout(() => {
        successToast.classList.remove('animate-slide-in');
        successToast.classList.add('animate-slide-out');
        
        // Remove after animation completes
        setTimeout(() => {
          if (successToast && successToast.parentNode === document.body) {
            document.body.removeChild(successToast);
          }
        }, 300);
      }, 100);

      // Remove after 2 seconds for better UX
      setTimeout(() => {
        successToast.classList.add('animate-slide-out');
        
        // Remove after animation completes
        setTimeout(() => {
          if (successToast && successToast.parentNode === document.body) {
            document.body.removeChild(successToast);
          }
        }, 300);
      }, 2000);

      

      // Show success state on button

      setShowSuccess(true);

      

      // Play success sound (subtle notification)

      try {

        const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIG2m98OScTgwOUarm7blmGgU7k9n1unEiBC13yO/eizEIHWq+8+OWT');

        audio.volume = 0.3;

        audio.play().catch(() => {}); // Silent fail if audio not supported

      } catch (e) {

        // Ignore audio errors

      }

      

      // Trigger comprehensive real-time sync events

      console.log('🎫 Payment: Dispatching sync events for entry creation...');

      // Dispatch discount-specific events for additional discount tracking
      if (payload.additionalDiscount > 0) {
        console.log('💰 Payment: Dispatching additional discount update event:', payload.additionalDiscount);
        window.dispatchEvent(new CustomEvent('additional-discount-updated', {
          detail: {
            entryId: result.id,
            additionalDiscount: payload.additionalDiscount,
            timestamp: new Date().toISOString(),
            source: 'payment-form'
          }
        }));
      }
      
      if (payload.kidDiscount > 0 || payload.additionalDiscount > 0) {
        console.log('💰 Payment: Dispatching total discount update event');
        window.dispatchEvent(new CustomEvent('discount-updated', {
          detail: {
            entryId: result.id,
            kidDiscount: payload.kidDiscount,
            additionalDiscount: payload.additionalDiscount,
            totalDiscount: payload.kidDiscount + payload.additionalDiscount,
            timestamp: new Date().toISOString(),
            source: 'payment-form'
          }
        }));
      }
      
      window.dispatchEvent(new CustomEvent('entry-created', { 

        detail: { 

          entryId: result.id, 

          action: 'create',

          timestamp: new Date().toISOString(),

          entryData: result

        } 

      }));

      

      // Also dispatch payment-completed event

      window.dispatchEvent(new CustomEvent('payment-completed', { 

        detail: { 

          entryId: result.id, 

          action: 'payment',

          timestamp: new Date().toISOString(),

          paymentData: payload

        } 

      }));

      

      // Dispatch excel-synced event for Excel components

      window.dispatchEvent(new CustomEvent('excel-synced', {

        detail: { 

          timestamp: new Date().toISOString(), 

          action: 'entry-created',

          entryId: result.id,

          paymentData: payload

        }

      }));

      

      console.log('✅ Payment: All sync events dispatched successfully');
      
      // Trigger window events for real-time updates instead of global sync service
      window.dispatchEvent(new CustomEvent('immediate-sync', {
        detail: {
          source: 'new-entry-created',
          timestamp: new Date().toISOString()
        }
      }));
      
      // Trigger specific data type sync events
      window.dispatchEvent(new CustomEvent('data-types-synced', {
        detail: {
          dataTypes: ['stats', 'entries', 'discounts'],
          timestamp: new Date().toISOString()
        }
      }));

      

      // Show confirmation before proceeding

      setShowConfirmation(true);

      
      // Prepare receipt data and show receipt
      const receiptPayload = {
        ...payload,
        createdAt: new Date().toISOString()
      };
      setReceiptData(receiptPayload);
      setShowReceipt(true);
      
      // Trigger receipt-printed event for real-time sync
      window.dispatchEvent(new CustomEvent('receipt-printed', {
        detail: {
          entryId: (payload as any).id || 'new',
          receiptNumber: (receiptPayload as any).receiptNumber || 'Generated',
          printedBy: user?.username || 'User',
          timestamp: new Date().toISOString(),
          source: 'payment-page',
          entryData: {
            name: receiptPayload.name,
            mobile: receiptPayload.mobile,
            ticketType: receiptPayload.ticketType,
            finalAmount: receiptPayload.finalAmount
          }
        }
      }));
      
      // Also trigger general dashboard sync to refresh stats
      window.dispatchEvent(new CustomEvent('payment-completed', {
        detail: {
          action: 'receipt-generated',
          entryId: (payload as any).id || 'new',
          timestamp: new Date().toISOString(),
          source: 'payment-receipt-generation'
        }
      }));
      
      console.log('✅ Payment: Receipt generated and sync events dispatched');

      
      // Clear form data after successful submission

      clear();

    } catch (e) {

      console.error('Payment submission error:', e);

      const errorMessage = (e as Error).message ?? 'Failed to save';

      setSubmitError(errorMessage);

    }

  };



  const handleProceedToNewEntry = () => {

    navigate('/ticket');

  };



  // Auto-redirect to new entry after showing success

  useEffect(() => {

    if (showConfirmation) {

      setCountdown(3); // Reset countdown when showing confirmation

      

      const timer = setInterval(() => {

        setCountdown((prev) => {

          if (prev <= 1) {

            clearInterval(timer);

            navigate('/ticket');

            return 0;

          }

          return prev - 1;

        });

      }, 1000);

      

      return () => clearInterval(timer);

    }

  }, [showConfirmation, navigate]);



  const handleProceedToDashboard = () => {

    navigate(user?.role === 'admin' ? '/admin' : '/staff', { replace: true });

  };



  return (

    <Layout title="💳 Professional Payment Center">

      {/* Sunday Pricing Banner */}

      {isSunday() && (

        <motion.div

          initial={{ opacity: 0, y: -20 }}

          animate={{ opacity: 1, y: 0 }}

          className="bg-gradient-to-r from-orange-400 to-red-500 text-white p-4 rounded-xl mb-6 border-2 border-orange-600 shadow-lg"

        >

          <div className="flex items-center justify-center">

            <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">

              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />

            </svg>

            <span className="font-bold text-lg">🎉 Sunday Special! ₹50 Extra on All Tickets (Except ₹150 & ₹100)</span>

            <svg className="w-6 h-6 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">

              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />

            </svg>

          </div>

        </motion.div>

      )}

      

      <div className="max-w-7xl mx-auto">

        {/* Money Statistics Dashboard */}

        <motion.div

          initial={{ opacity: 0, y: -20 }}

          animate={{ opacity: 1, y: 0 }}

          transition={{ duration: 0.5 }}

          className="mb-8"

        >

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Today's Entries */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-6 text-white shadow-xl"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-green-100 text-sm font-medium">Today's Entries</span>
                <span className="text-2xl">�</span>
              </div>
              <div className="text-3xl font-bold">{moneyStats.todayEntries || 0}</div>
              <div className="text-green-100 text-xs mt-1">Entries today</div>
            </motion.div>

            {/* Today's People */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 text-white shadow-xl"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-blue-100 text-sm font-medium">Today's People</span>
                <span className="text-2xl">�</span>
              </div>
              <div className="text-3xl font-bold">{moneyStats.todayPeople || 0}</div>
              <div className="text-blue-100 text-xs mt-1">Visitors today</div>
            </motion.div>

            {/* Peak Hour */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-6 text-white shadow-xl"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-purple-100 text-sm font-medium">Peak Hour</span>
                <span className="text-2xl">�</span>
              </div>
              <div className="text-3xl font-bold">{moneyStats.peakHour || 'N/A'}</div>
              <div className="text-purple-100 text-xs mt-1">Busiest time</div>
            </motion.div>

            {/* Conversion Rate */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-6 text-white shadow-xl"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-orange-100 text-sm font-medium">Conversion</span>
                <span className="text-2xl">📈</span>
              </div>
              <div className="text-3xl font-bold">{((moneyStats.conversionRate || 0) * 100).toFixed(1)}%</div>
              <div className="text-orange-100 text-xs mt-1">Success rate</div>
            </motion.div>
          </div>

        </motion.div>

        {/* User Info */}

        <motion.div

          initial={{ opacity: 0, y: -20 }}

          animate={{ opacity: 1, y: 0 }}

          transition={{ duration: 0.5, delay: 0.1 }}

          className="mb-6"

        >

          <div className="modern-card bg-gradient-to-r from-indigo-500 to-purple-600 border-2 border-indigo-400 shadow-xl">

            <div className="flex justify-between items-center">

              <div>

                <h3 className="heading-md text-white mb-1">

                  💳 Professional Payment Center

                </h3>

                <p className="text-indigo-100 font-medium">

                  👤 Processed by: <span className="font-bold text-white">{user?.fullName || user?.username}</span>

                </p>

              </div>

              <div className="text-right">

                <div className="text-4xl font-black text-white">

                  💳

                </div>

              </div>

            </div>

          </div>

        </motion.div>



        {/* Detailed Ticket Selections */}

        <motion.div

          initial={{ opacity: 0, y: 20 }}

          animate={{ opacity: 1, y: 0 }}

          transition={{ duration: 0.5, delay: 0.05 }}

          className="modern-card mb-8"

        >

          <h2 className="heading-lg text-blue-900 mb-6">

            🎫 Ticket Selection Details

          </h2>

          

          {/* Main Selection */}

          <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border-2 border-blue-200">

            <h3 className="text-lg font-bold text-blue-900 mb-3 flex items-center gap-2">

              <span className="bg-blue-600 text-white px-2 py-1 rounded text-sm">Main</span>

              Primary Ticket Selection

            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

              <div className="text-center">

                <p className="text-blue-800 font-medium text-sm">Ticket Type</p>

                <p className="text-blue-900 font-bold text-lg">

                  {dynamicTicketPrices.main ? `₹${dynamicTicketPrices.main}` : `₹${formData?.ticketType}`}

                </p>

              </div>

              <div className="text-center">

                <p className="text-blue-800 font-medium text-sm">Adults</p>

                <p className="text-blue-900 font-bold text-lg">{formData?.adults}</p>

              </div>

              <div className="text-center">

                <p className="text-blue-800 font-medium text-sm">Kids</p>

                <p className="text-blue-900 font-bold text-lg">{formData?.kids}</p>

              </div>

              <div className="text-center">

                <p className="text-blue-800 font-medium text-sm">Subtotal</p>

                <p className="text-green-600 font-bold text-lg">

                  {loadingPrices ? 'Loading...' : `₹${mainSubtotal}`}

                </p>

              </div>

            </div>

          </div>



          {/* Upgrade Selections */}

          {formData?.upgrades && formData.upgrades.length > 0 && (

            <div className="space-y-4">

              <h3 className="text-lg font-bold text-blue-900 mb-3 flex items-center gap-2">

                <span className="bg-purple-600 text-white px-2 py-1 rounded text-sm">Upgrades</span>

                Additional Ticket Selections

              </h3>

              {formData.upgrades.map((upgrade, index) => (

                <div key={index} className="p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl border-2 border-purple-200">

                  <div className="flex items-center justify-between mb-3">

                    <h4 className="font-bold text-purple-900">Upgrade {index + 1}</h4>

                    <span className="bg-purple-100 text-purple-800 px-3 py-1 rounded-full text-sm font-medium">

                      {dynamicTicketPrices[`upgrade_${index}`] ? `₹${dynamicTicketPrices[`upgrade_${index}`]}` : `₹${upgrade.ticketType}`} Ticket

                    </span>

                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

                    <div className="text-center">

                      <p className="text-purple-800 font-medium text-sm">Ticket Type</p>

                      <p className="text-purple-900 font-bold text-lg">

                        {dynamicTicketPrices[`upgrade_${index}`] ? `₹${dynamicTicketPrices[`upgrade_${index}`]}` : `₹${upgrade.ticketType}`}

                      </p>

                    </div>

                    <div className="text-center">

                      <p className="text-purple-800 font-medium text-sm">Adults</p>

                      <p className="text-purple-900 font-bold text-lg">{upgrade.adults}</p>

                    </div>

                    <div className="text-center">

                      <p className="text-purple-800 font-medium text-sm">Kids</p>

                      <p className="text-purple-900 font-bold text-lg">{upgrade.kids}</p>

                    </div>

                    <div className="text-center">

                      <p className="text-purple-800 font-medium text-sm">Subtotal</p>

                      <p className="text-green-600 font-bold text-lg">

                        {loadingPrices ? 'Loading...' : `₹${upgradeSubtotals[index] || 0}`}

                      </p>

                    </div>

                  </div>

                </div>

              ))}

            </div>

          )}



          {/* Food Coupons Section */}

          {(formData?.adultsFastFoodCoupon || formData?.kidsFastFoodCoupon || formData?.adultsMainFoodCoupon || formData?.kidsMainFoodCoupon) && (

            <div className="mt-6 p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl border-2 border-green-200">

              <h3 className="text-lg font-bold text-green-900 mb-3 flex items-center gap-2">

                <span className="bg-green-600 text-white px-2 py-1 rounded text-sm">🍽️</span>

                Food Coupons

              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                {formData?.adultsFastFoodCoupon && (

                  <div className="bg-orange-50 p-3 rounded-lg border border-orange-200">

                    <p className="text-orange-800 font-medium text-sm">Adults Fast Food Coupon</p>

                    <p className="text-orange-900 font-bold">{formData.adultsFastFoodCoupon}</p>

                  </div>

                )}

                {formData?.kidsFastFoodCoupon && (

                  <div className="bg-orange-50 p-3 rounded-lg border border-orange-200">

                    <p className="text-orange-800 font-medium text-sm">Kids Fast Food Coupon</p>

                    <p className="text-orange-900 font-bold">{formData.kidsFastFoodCoupon}</p>

                  </div>

                )}

                {formData?.adultsMainFoodCoupon && (

                  <div className="bg-green-50 p-3 rounded-lg border border-green-200">

                    <p className="text-green-800 font-medium text-sm">Adults Main Food Coupon</p>

                    <p className="text-green-900 font-bold">{formData.adultsMainFoodCoupon}</p>

                  </div>

                )}

                {formData?.kidsMainFoodCoupon && (

                  <div className="bg-green-50 p-3 rounded-lg border border-green-200">

                    <p className="text-green-800 font-medium text-sm">Kids Main Food Coupon</p>

                    <p className="text-green-900 font-bold">{formData.kidsMainFoodCoupon}</p>

                  </div>

                )}

              </div>

            </div>

          )}

        </motion.div>



        {/* Payment Summary Card */}

        <motion.div

          initial={{ opacity: 0, y: 20 }}

          animate={{ opacity: 1, y: 0 }}

          transition={{ duration: 0.5 }}

          className="modern-card mb-8"

        >

          <h2 className="heading-lg text-blue-900 mb-6">

            💳 Payment Summary

          </h2>

          

          {/* Totals Overview */}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">

            <div className="text-center p-4 bg-blue-50 rounded-lg border border-blue-200">

              <p className="text-blue-800 font-medium text-sm">Total People</p>

              <p className="text-blue-900 font-bold text-xl">{loadingPrices ? '...' : totalPeople}</p>

            </div>

            <div className="text-center p-4 bg-green-50 rounded-lg border border-green-200">

              <p className="text-green-800 font-medium text-sm">Base Amount</p>

              <p className="text-green-900 font-bold text-xl">{loadingPrices ? '₹...' : `₹${baseAmount}`}</p>

            </div>

            <div className="text-center p-4 bg-orange-50 rounded-lg border border-orange-200">

              <p className="text-orange-800 font-medium text-sm">Kid Discount</p>

              <p className="text-orange-900 font-bold text-xl">{loadingPrices ? '₹...' : `-₹${kidDiscount}`}</p>

            </div>

            <div className="text-center p-4 bg-purple-50 rounded-lg border border-purple-200">

              <p className="text-purple-800 font-medium text-sm">Final Amount</p>

              <p className="text-purple-900 font-bold text-xl">{loadingPrices ? '₹...' : `₹${finalAmount}`}</p>

            </div>

          </div>

          

          {/* Additional Discount Section */}

          <div className="border-t border-blue-200 pt-6 mt-6">

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">

              <div className="space-y-2">

                <p className="text-blue-800 font-medium">Additional Discount:</p>

                <p className="text-red-600 font-bold text-xl">-₹{additionalDiscount}</p>

              </div>

              <div className="space-y-2">

                <p className="text-blue-800 font-medium">Amount After Discount:</p>

                <p className="text-green-600 font-black text-2xl">{loadingPrices ? '₹...' : `₹${finalAmount}`}</p>

              </div>

            </div>

          </div>

        </motion.div>



        {/* Payment Form */}

        <motion.div

          initial={{ opacity: 0, y: 20 }}

          animate={{ opacity: 1, y: 0 }}

          transition={{ duration: 0.5, delay: 0.1 }}

          className="modern-card mb-8"

        >

          <h2 className="heading-lg text-blue-900 mb-6">

            💳 Payment Details

          </h2>

          {/* Loading indicator for dynamic pricing */}

          {loadingPrices && (

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">

              <div className="flex items-center justify-center">

                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mr-3"></div>

                <span className="text-blue-800 font-medium">Fetching updated ticket prices...</span>

              </div>

            </div>

          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">

            {/* Cash Amount */}

            <motion.div

              initial={{ opacity: 0, y: 20 }}

              animate={{ opacity: 1, y: 0 }}

              transition={{ delay: 0.2 }}

            >

              <label className="block text-blue-900 font-bold text-lg mb-3">

                💰 Amount in Cash / नकद में राशि

              </label>

              <input

                {...register('cashAmount', { valueAsNumber: true })}

                type="number"

                min={0}

                value={cashAmount || ''}

                onChange={(e) => setValue('cashAmount', Number(e.target.value) || 0)}

                className={`input-modern text-lg ${

                  cashAmount > 0 && cashAmount <= finalAmount

                    ? 'bg-green-50 border-green-300'

                    : cashAmount > finalAmount

                    ? 'bg-red-50 border-red-300'

                    : ''

                }`}

                placeholder="0"

              />

              {errors.cashAmount && (

                <p className="text-red-900 font-bold text-sm mt-2">❌ {errors.cashAmount.message}</p>

              )}

            </motion.div>



            {/* UPI Amount */}

            <motion.div

              initial={{ opacity: 0, y: 20 }}

              animate={{ opacity: 1, y: 0 }}

              transition={{ delay: 0.3 }}

            >

              <label className="block text-blue-900 font-bold text-lg mb-3">

                💳 Amount in UPI-ONLINE /UPI-ONLINE में राशि

              </label>

              <input

                {...register('upiAmount', { valueAsNumber: true })}

                type="number"

                min={0}

                value={upiAmount || ''}

                onChange={(e) => setValue('upiAmount', Number(e.target.value) || 0)}

                className={`input-modern text-lg ${

                  upiAmount > 0 && upiAmount <= finalAmount

                    ? 'bg-green-50 border-green-300'

                    : upiAmount > finalAmount

                    ? 'bg-red-50 border-red-300'

                    : ''

                }`}

                placeholder="0"

              />

              {errors.upiAmount && (

                <p className="text-red-900 font-bold text-sm mt-2">❌ {errors.upiAmount.message}</p>

              )}

            </motion.div>



            {/* Advance Amount */}

            <motion.div

              initial={{ opacity: 0, y: 20 }}

              animate={{ opacity: 1, y: 0 }}

              transition={{ delay: 0.35 }}

            >

              <label className="block text-blue-900 font-bold text-lg mb-3">

                🤝 Advance Money /अग्रिम राशि

              </label>

              <input

                {...register('advanceAmount', { valueAsNumber: true })}

                type="number"

                min={0}

                value={advanceAmount || ''}

                onChange={(e) => setValue('advanceAmount', Number(e.target.value) || 0)}

                className={`input-modern text-lg ${
                  advanceAmount > 0 && advanceAmount <= finalAmount
                    ? 'bg-green-50 border-green-300'
                    : advanceAmount > finalAmount
                    ? 'bg-red-50 border-red-300'
                    : ''
                }`}

                placeholder="0"

              />

              {errors.advanceAmount && (

                <p className="text-red-900 font-bold text-sm mt-2">❌ {errors.advanceAmount.message}</p>

              )}

            </motion.div>



            {/* Additional Discount */}

            <motion.div

              initial={{ opacity: 0, y: 20 }}

              animate={{ opacity: 1, y: 0 }}

              transition={{ delay: 0.4 }}

            >

              <label className="block text-blue-900 font-bold text-lg mb-3">

                💰 Additional Discount

              </label>

              <input

                {...register('additionalDiscount', { valueAsNumber: true })}

                type="number"

                min={0}

                value={additionalDiscount || ''}

                onChange={(e) => setValue('additionalDiscount', Number(e.target.value) || 0)}

                className="input-modern text-lg"

                placeholder="0"

              />

              {errors.additionalDiscount && (

                <p className="text-red-900 font-bold text-sm mt-2">❌ {errors.additionalDiscount.message}</p>

              )}

            </motion.div>



            {/* Notes */}

            <motion.div

              initial={{ opacity: 0, y: 20 }}

              animate={{ opacity: 1, y: 0 }}

              transition={{ delay: 0.5 }}

            >

              <label className="block text-blue-900 font-bold text-lg mb-3">

                📝 Notes (Optional)

              </label>

              <textarea

                {...register('notes')}

                className="input-modern text-lg min-h-[100px]"

                placeholder="Add any notes here..."

              />

              {errors.notes && (

                <p className="text-red-900 font-bold text-sm mt-2">❌ {errors.notes.message}</p>

              )}

            </motion.div>



            {/* Payment Validation Message */}

            {!isPaymentValid && (

              <motion.div

                initial={{ opacity: 0, x: -20 }}

                animate={{ opacity: 1, x: 0 }}

                className="bg-yellow-50 border-2 border-yellow-200 rounded-xl p-4"

              >

                <p className="text-yellow-900 font-bold text-center">

                  ⚠️ Payment amounts must equal the final amount after discount (₹{finalAmount})

                </p>

                <p className="text-yellow-800 text-center mt-2">

                  Current Total: ₹{totalPayment} | Required: ₹{finalAmount}

                </p>

              </motion.div>

            )}



            {/* Submit Button */}

            <motion.div

              initial={{ opacity: 0, y: 20 }}

              animate={{ opacity: 1, y: 0 }}

              transition={{ duration: 0.6 }}

              className="flex justify-end gap-4"

            >

              <motion.button

                type="button"

                onClick={() => navigate('/ticket')}

                whileHover={{ scale: 1.02 }}

                whileTap={{ scale: 0.98 }}

                className="px-8 py-4 rounded-xl bg-white hover:bg-gray-50 text-blue-700 font-bold text-lg border-2 border-gray-300 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"

              >

                ← Back to Ticket

              </motion.button>

              <motion.button

                type="submit"

                disabled={isSubmitting || !isPaymentValid || loadingPrices}

                whileHover={{ scale: 1.02 }}

                whileTap={{ scale: 0.98 }}

                className={`px-12 py-6 rounded-xl font-bold text-lg transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-1 ${

                  showSuccess

                    ? 'bg-gradient-to-r from-green-500 to-green-600 text-white cursor-default'

                    : isPaymentValid && !isSubmitting

                    ? 'bg-gradient-to-r from-blue-600 to-blue-800 hover:from-blue-700 hover:to-blue-900 text-white cursor-pointer'

                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'

                }`}

              >

                {isSubmitting ? (

                  <span className="flex items-center gap-2">

                    <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>

                    <span>Processing...</span>

                  </span>

                ) : showSuccess ? (

                  <span className="flex items-center gap-2">

                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">

                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />

                    </svg>

                    <span>Entry Saved!</span>

                  </span>

                ) : loadingPrices ? (

                  <span className="flex items-center gap-2">

                    <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>

                    <span>Loading Prices...</span>

                  </span>

                ) : (

                  <span className="flex items-center gap-2">

                    <svg className="w-5 h-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>

                    <span>Save & Continue</span>

                  </span>

                )}

              </motion.button>

            </motion.div>

          </form>

        </motion.div>



        {/* Error Message */}

        {submitError && (

          <motion.div

            initial={{ opacity: 0, y: 20 }}

            animate={{ opacity: 1, y: 0 }}

            className="bg-red-50 border-2 border-red-200 rounded-xl p-4 mb-8"

          >

            <p className="text-red-900 font-bold text-center">{submitError}</p>

          </motion.div>

        )}

      </div>



      {/* Confirmation Modal */}

      {showConfirmation && (

        <motion.div

          initial={{ opacity: 0 }}

          animate={{ opacity: 1 }}

          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md"

        >

          {/* Success Particles */}

          <div className="absolute inset-0 pointer-events-none">

            {[...Array(6)].map((_, i) => (

              <motion.div

                key={i}

                className="absolute w-2 h-2 bg-green-400 rounded-full"

                initial={{ 

                  x: '50%', 

                  y: '50%',

                  scale: 0,

                  opacity: 1

                }}

                animate={{

                  x: `${50 + (Math.random() - 0.5) * 100}%`,

                  y: `${50 + (Math.random() - 0.5) * 100}%`,

                  scale: [0, 1, 0],

                  opacity: [1, 1, 0]

                }}

                transition={{

                  duration: 2,

                  delay: i * 0.1,

                  repeat: Infinity,

                  repeatDelay: 3

                }}

              />

            ))}

          </div>



          <motion.div

            initial={{ scale: 0.8, opacity: 0 }}

            animate={{ scale: 1, opacity: 1 }}

            className="modern-card rounded-3xl p-10 max-w-lg w-full text-center relative bg-gradient-to-br from-white via-blue-50 to-indigo-50 border-4 border-blue-200 shadow-2xl"

          >

            {/* Animated Background Gradient */}

            <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-blue-400/10 via-purple-400/10 to-pink-400/10 animate-pulse"></div>

            

            {/* Success Particles */}

            <div className="absolute inset-0 pointer-events-none">

              {[...Array(12)].map((_, i) => (

                <motion.div

                  key={i}

                  className="absolute w-3 h-3 bg-gradient-to-r from-blue-400 to-purple-400 rounded-full"

                  initial={{ 

                    x: '50%', 

                    y: '50%',

                    scale: 0,

                    opacity: 1

                  }}

                  animate={{

                    x: `${50 + (Math.random() - 0.5) * 150}%`,

                    y: `${50 + (Math.random() - 0.5) * 150}%`,

                    scale: [0, 1.5, 0],

                    opacity: [1, 1, 0]

                  }}

                  transition={{

                    duration: 3,

                    delay: i * 0.15,

                    repeat: Infinity,

                    repeatDelay: 4

                  }}

                />

              ))}

            </div>



            <div className="relative z-10 mb-8">

              {/* Animated Success Icon */}

              <motion.div

                className="w-24 h-24 mx-auto mb-6 rounded-full bg-gradient-to-br from-green-400 via-emerald-500 to-green-600 flex items-center justify-center shadow-2xl border-4 border-white"

                animate={{ 

                  scale: [1, 1.3, 1],

                  rotate: [0, 5, -5, 0]

                }}

                transition={{ 

                  duration: 1.5,

                  rotate: { duration: 0.5, ease: "easeInOut" }

                }}

              >

                <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">

                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />

                </svg>

              </motion.div>

              

              {/* Success Title */}

              <motion.h3 

                className="heading-xl bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-4"

                initial={{ y: -30, opacity: 0 }}

                animate={{ y: 0, opacity: 1 }}

                transition={{ delay: 0.3 }}

              >

                🎉 Entry Saved Successfully!

              </motion.h3>

              

              {/* Success Message */}

              <motion.p 

                className="text-gray-700 text-xl font-medium mb-4"

                initial={{ y: 20, opacity: 0 }}

                animate={{ y: 0, opacity: 1 }}

                transition={{ delay: 0.4 }}

              >

                Your ticket entry has been saved to the database

              </motion.p>

              {/* Receipt Button */}
              <motion.button
                onClick={() => {
                  setShowConfirmation(false);
                  setShowReceipt(true);
                }}
                className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-bold text-lg py-4 px-6 rounded-xl shadow-lg border-2 border-green-500 transition-all duration-200 flex items-center justify-center gap-2 mb-4"
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.3 }}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm2-4h.01M17 16h.01" />
                </svg>
                🧾 View Receipt
              </motion.button>

              {/* Auto-redirect Message */}

              <motion.p 

                className="text-green-600 font-bold text-xl mb-6"

                initial={{ y: 20, opacity: 0 }}

                animate={{ y: 0, opacity: 1 }}

                transition={{ delay: 0.5 }}

              >

                <span className="flex items-center justify-center gap-2">

                  <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">

                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />

                  </svg>

                  Auto-redirecting in {countdown} seconds...

                </span>

              </motion.p>

              {/* Entry Summary */}

              <motion.div

                className="bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 rounded-2xl p-6 mb-6 text-left border-2 border-indigo-300 shadow-xl"

                initial={{ y: 20, opacity: 0 }}

                animate={{ y: 0, opacity: 1 }}

                transition={{ delay: 0.5 }}

              >

                <h4 className="font-bold text-indigo-900 mb-3 text-lg flex items-center gap-2">

                  <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">

                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm2-4h.01M17 16h.01" />

                  </svg>

                  Entry Summary

                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">

                  <div className="flex items-center gap-2">

                    <span className="font-semibold text-gray-600">👤</span>

                    <span className="text-gray-800">

                      <span className="font-medium">Name:</span> 

                      <span className="text-blue-900 font-bold">{formData?.name}</span>

                    </span>

                  </div>

                  <div className="flex items-center gap-2">

                    <span className="font-semibold text-gray-600">📱</span>

                    <span className="text-gray-800">

                      <span className="font-medium">Mobile:</span> 

                      <span className="text-blue-900 font-bold">{formData?.mobile}</span>

                    </span>

                  </div>

                  <div className="flex items-center gap-2">

                    <span className="font-semibold text-gray-600">🎫</span>

                    <span className="text-gray-800">

                      <span className="font-medium">Ticket:</span> 

                      <span className="text-blue-900 font-bold">{formData?.ticketType && `₹${formData.ticketType}`}</span>

                    </span>

                  </div>

                  <div className="flex items-center gap-2">

                    <span className="font-semibold text-gray-600">👥</span>

                    <span className="text-gray-800">

                      <span className="font-medium">People:</span> 

                      <span className="text-blue-900 font-bold">{formData?.adults} Adults, {formData?.kids} Kids</span>

                    </span>

                  </div>

                  <div className="flex items-center gap-2 sm:col-span-2">

                    <span className="font-semibold text-gray-600">💰</span>

                    <span className="text-gray-800">

                      <span className="font-medium">Amount:</span> 

                      <span className="text-green-900 font-bold text-lg">₹{finalAmount}</span>

                    </span>

                  </div>

                  <div className="flex items-center gap-2">

                    <span className="font-semibold text-gray-600">✍️</span>

                    <span className="text-gray-800">

                      <span className="font-medium">Filled By:</span> 

                      <span className="text-blue-900 font-bold">{user?.fullName || user?.username}</span>

                    </span>

                  </div>

                </div>

              </motion.div>

            </div>

            

            <motion.div

              className="space-y-4"

              initial={{ y: 20, opacity: 0 }}

              animate={{ y: 0, opacity: 1 }}

              transition={{ delay: 0.6 }}

            >

              <motion.button

                onClick={handleProceedToNewEntry}

                whileHover={{ scale: 1.02 }}

                whileTap={{ scale: 0.98 }}

                className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-bold text-lg py-4 px-6 rounded-xl shadow-lg border-2 border-blue-500 transition-all duration-200 flex items-center justify-center gap-2"

              >

                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">

                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />

                </svg>

                🎫 Continue to Next Entry

              </motion.button>

              <motion.button

                onClick={handleProceedToDashboard}

                whileHover={{ scale: 1.02 }}

                whileTap={{ scale: 0.98 }}

                className="w-full bg-gradient-to-r from-gray-100 to-gray-200 hover:from-gray-200 hover:to-gray-300 text-blue-900 font-bold text-lg py-4 px-6 rounded-xl shadow-lg border-2 border-gray-400 transition-all duration-200 flex items-center justify-center gap-2"

              >

                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">

                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 00-1h-3a1 1 0 00-1 1z" />

                </svg>

                📊 Go to Dashboard

              </motion.button>

            </motion.div>

          </motion.div>

        </motion.div>
      )}

      {/* Receipt Modal */}
      {showReceipt && receiptData && (
        <Receipt
          data={receiptData}
          onClose={() => setShowReceipt(false)}
        />
      )}
    </Layout>

  );

}
// ... (rest of the code remains the same)
