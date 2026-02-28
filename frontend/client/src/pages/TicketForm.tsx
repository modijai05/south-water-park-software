import { useMemo, useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { useFieldArray } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Layout } from '@/components/Layout';
import { useEntryStore } from '@/store/entryStore';
import { useAuthStore } from '@/store/authStore';
import { computeAmountsSync, isSunday, getTicketPriceSync, getTicketLabelSync } from '@/lib/ticketUtils';
import { ticketConfigApi } from '@/lib/ticketApi';
import type { TicketType, TicketConfig } from '@/types';

// Single ticket selection schema with validation
const ticketSelectionSchema = z.object({
  ticketType: z.enum(['150', '300', '450', '600', '100']),
  adults: z.number().min(0).max(30),
  kids: z.number().min(0).max(30),
  adultsFastFoodCoupon: z.string().optional(),
  kidsFastFoodCoupon: z.string().optional(),
  adultsMainFoodCoupon: z.string().optional(),
  kidsMainFoodCoupon: z.string().optional(),
}).refine(
  (data) => {
    // At least one person must be selected
    if (data.adults === 0 && data.kids === 0) return false;
    
    // 150 tickets don't allow kids
    if (data.ticketType === '150' && data.kids > 0) return false;
    
    // 100 tickets don't allow kids (sitting only)
    if (data.ticketType === '100' && data.kids > 0) return false;
    
    return true;
  },
  {
    message: "Invalid selection: At least one person must be selected, and 150/100 tickets don't allow kids",
    path: ['adults']
  }
);

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  mobile: z.string().min(10, 'Valid mobile required').regex(/^\d{10}$/, '10 digits only'),
  selections: z.array(ticketSelectionSchema).min(1, 'At least one ticket selection is required'),
  additionalDiscount: z.number().min(0).default(0),
});

type FormData = z.infer<typeof schema>;

const defaultValues: FormData = {
  name: '',
  mobile: '',
  selections: [
    {
      ticketType: '150',
      adults: 1,
      kids: 0,
      adultsFastFoodCoupon: '',
      kidsFastFoodCoupon: '',
      adultsMainFoodCoupon: '',
      kidsMainFoodCoupon: '',
    }
  ],
  additionalDiscount: 0,
};

export function TicketForm() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { formData } = useEntryStore();
  const [ticketConfigs, setTicketConfigs] = useState<TicketConfig[]>([]);
  const [loadingConfigs, setLoadingConfigs] = useState(true);
  const [configUpdateNotification, setConfigUpdateNotification] = useState<string | null>(null);
  const [updatingConfigs, setUpdatingConfigs] = useState(false);
  
  // Performance optimization: Price cache to avoid repeated calculations
  const priceCacheRef = useRef<Map<TicketType, number>>(new Map());
  const [isCalculating, setIsCalculating] = useState(false);
  const [lastCalculationTime, setLastCalculationTime] = useState(0);
  
  // Separate state for calculation tracking to avoid re-renders
  const calculationTrackerRef = useRef({
    startTime: 0,
    timeoutId: null as NodeJS.Timeout | null
  });
  
  // Fetch ticket configurations
  const fetchConfigs = async () => {
    try {
      console.log('🔄 TicketForm: Fetching ticket configs...');
      // Use the same API as dashboard to get full configs with all day-wise pricing
      const result = await ticketConfigApi.getAll();
      console.log('✅ TicketForm: Fetched configs:', result);
      // Handle both old format (direct array) and new format (success/data wrapper)
      const configs = Array.isArray(result) ? result : ((result as any)?.data || []);
      setTicketConfigs(configs);
    } catch (error) {
      console.error('❌ Failed to fetch ticket configs:', error);
      // Fallback to static options will be handled in useMemo
    } finally {
      setLoadingConfigs(false);
    }
  };

  // Fetch ticket configurations on mount - simplified to prevent infinite loops
  useEffect(() => {
    fetchConfigs();
  }, []); // Empty dependency array - run only once

  // Listen for real-time ticket config updates from admin panel
  useEffect(() => {
    const handleTicketConfigUpdate = (event: CustomEvent) => {
      console.log('🎉 TicketForm: Received ticket config update event:', event.detail);
      setConfigUpdateNotification('🔄 Ticket prices updated by admin!');
      
      console.log('🔄 TicketForm: Clearing price cache and fetching updated configs...');
      // Clear price cache to force recalculation with new pricing
      priceCacheRef.current.clear();
      
      // Fetch updated configs
      fetchConfigs().then(() => {
        console.log('✅ TicketForm: Configs updated after event');
        setTimeout(() => setConfigUpdateNotification(null), 3000);
      });
    };

    console.log('👂 TicketForm: Setting up ticket-config-updated event listener');
    // Add event listener
    window.addEventListener('ticket-config-updated', handleTicketConfigUpdate as EventListener);
    
    // Cleanup
    return () => {
      console.log('🧹 TicketForm: Cleaning up ticket-config-updated event listener');
      window.removeEventListener('ticket-config-updated', handleTicketConfigUpdate as EventListener);
    };
  }, []); // Run once on mount

  // Helper function to get current day's price for display
  const getCurrentDayPrice = (ticketType: string): number => {
    const config = ticketConfigs.find(c => c.ticketType === ticketType);
    if (config && config.dayWisePricing.length > 0) {
      const today = new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
      const todayPricing = config.dayWisePricing.find(dp => dp.day === today && dp.enabled);
      
      if (todayPricing) {
        if (todayPricing.fixedAmount !== undefined) {
          return todayPricing.fixedAmount;
        }
        return Math.round(config.basePrice * todayPricing.priceMultiplier);
      }
    }
    
    if (config) {
      return config.basePrice;
    }
    
    // Fallback to static price
    return getTicketPriceSync(ticketType as TicketType);
  };

  // Helper function to get current day's label
  const getCurrentDayLabel = (ticketType: string): string => {
    const config = ticketConfigs.find(c => c.ticketType === ticketType);
    if (config) {
      return config.label;
    }
    // Fallback to static label
    return getTicketLabelSync(ticketType as TicketType);
  };

  // Dynamic ticket options based on admin configuration - optimized to prevent infinite loops
  const dynamicTicketOptions = useMemo(() => {
    if (ticketConfigs.length === 0) {
      // Fallback to static options if config not loaded
      return [
        { value: '150' as TicketType, label: '₹150 – Without Food (1 Hour)', price: 150, hasKids: false },
        { value: '300' as TicketType, label: '₹300 – Without Food (3–4 Hours)', price: 300, hasKids: true },
        { value: '450' as TicketType, label: '₹450 – With Fast Food (3–4 Hours)', price: 450, hasKids: true },
        { value: '600' as TicketType, label: '₹600 – With Main Food (4–5 Hours)', price: 600, hasKids: true },
        { value: '100' as TicketType, label: 'Special ticket with Sitting Only', price: 100, hasKids: false }
      ];
    }
    
    // Generate options from dynamic configs - stable reference
    return Array.isArray(ticketConfigs) 
      ? ticketConfigs
          .filter(config => config.isActive)
          .map(config => {
        const baseLabel = config.label || `${config.ticketType} Ticket`;
        const priceDisplay = `₹${config.basePrice}`;
        const features = [];
        
        if (config.hasKids) features.push('Kids Allowed');
        if (config.foodIncluded) features.push('Food Included');
        if (config.timeLimit) features.push(`${config.timeLimit} Hours`);
        
        const featureText = features.length > 0 ? ` – ${features.join(', ')}` : '';
        const label = `${priceDisplay} – ${baseLabel}${featureText}`;
        
        return {
          value: config.ticketType,
          label,
          price: config.basePrice,
          hasKids: config.hasKids
        };
      })
      .sort((a, b) => a.price - b.price) // Sort by price
      : []; // Fallback to empty array if ticketConfigs is not an array
  }, [ticketConfigs.length, Array.isArray(ticketConfigs) ? ticketConfigs.map(c => `${c.ticketType}-${c.basePrice}-${c.isActive}`).join(',') : '']); // Stable dependency

  const {
    register,
    watch,
    control,
    handleSubmit,
    formState: { errors },
    reset,
    getValues,
    setValue,
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues,
    mode: 'onChange', // Enable real-time validation and updates
  });

  // Watch for real-time updates to trigger instant calculation
  const watchedSelections = watch('selections');
  const watchedAdditionalDiscount = watch('additionalDiscount');

  // Restore form data from store if available (when navigating back from payment)
  useEffect(() => {
    if (formData) {
      reset({
        name: formData.name,
        mobile: formData.mobile,
        selections: [
          {
            ticketType: formData.ticketType,
            adults: formData.adults,
            kids: formData.kids,
            adultsFastFoodCoupon: formData.adultsFastFoodCoupon || '',
            kidsFastFoodCoupon: formData.kidsFastFoodCoupon || '',
            adultsMainFoodCoupon: formData.adultsMainFoodCoupon || '',
            kidsMainFoodCoupon: formData.kidsMainFoodCoupon || '',
          },
          ...(formData.upgrades || [])
        ],
        additionalDiscount: formData.additionalDiscount || 0,
      });
    }
  }, [formData, reset]);

  const selections = watch('selections');

  // Check if any selection has 450 ticket type
  const has450Ticket = useMemo(() => {
    const result = selections.some(s => s.ticketType === '450');
    return result;
  }, [selections]);

  // Check if any selection has 600 ticket type
  const has600Ticket = useMemo(() => {
    const result = selections.some(s => s.ticketType === '600');
    return result;
  }, [selections]);

  // Combined food coupon visibility
  const showFoodCoupons = has450Ticket || has600Ticket;

  // Optimized instant calculation with dynamic config support
  const calculateInstantAmount = useCallback((ticketType: TicketType, adults: number, kids: number) => {
    // Try to get price from dynamic configs first (with day-wise pricing)
    let ticketPrice = 0;
    
    const config = ticketConfigs.find(c => c.ticketType === ticketType);
    if (config && config.dayWisePricing.length > 0) {
      // Get current day name
      const today = new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
      const todayPricing = config.dayWisePricing.find(dp => dp.day === today && dp.enabled);
      
      if (todayPricing) {
        if (todayPricing.fixedAmount !== undefined) {
          ticketPrice = todayPricing.fixedAmount;
        } else {
          ticketPrice = Math.round(config.basePrice * todayPricing.priceMultiplier);
        }
      } else {
        ticketPrice = config.basePrice;
      }
    } else if (config) {
      ticketPrice = config.basePrice;
    } else {
      // Fallback to cached or static price
      if (!priceCacheRef.current.has(ticketType)) {
        ticketPrice = getTicketPriceSync(ticketType);
        priceCacheRef.current.set(ticketType, ticketPrice);
      } else {
        ticketPrice = priceCacheRef.current.get(ticketType)!;
      }
    }
    
    const hasKids = ticketType !== '150' && ticketType !== '100';
    const baseAmount = adults * ticketPrice + (hasKids ? kids * ticketPrice : 0);
    const kidCount = hasKids ? kids : 0;
    const kidDiscount = kidCount * 100;
    const finalAmount = Math.max(0, baseAmount - kidDiscount);
    const people = (ticketType === '150' || ticketType === '100') ? adults : adults + kidCount;
    
    return {
      baseAmount,
      kidDiscount,
      finalAmount,
      people
    };
  }, [ticketConfigs]); // Include ticketConfigs in dependencies

  // Debounced calculation with performance optimization
  const totalAmounts = useMemo(() => {
    const currentSelections = watchedSelections || selections;
    
    // Early return for empty selections
    if (!currentSelections || currentSelections.length === 0) {
      return {
        baseAmount: 0,
        kidDiscount: 0,
        finalAmount: 0,
        totalPeople: 0
      };
    }
    
    // Optimized single-pass calculation
    let totalBaseAmount = 0;
    let totalKidDiscount = 0;
    let totalPeople = 0;
    
    for (const selection of currentSelections) {
      // Skip empty selections early
      if (!selection || (selection.adults === 0 && selection.kids === 0)) continue;
      
      // Skip invalid combinations early
      if (selection.ticketType === '150' && selection.kids > 0) continue;
      if (selection.ticketType === '100' && selection.kids > 0) continue;
      
      // Get cached price or calculate once
      let ticketPrice = priceCacheRef.current.get(selection.ticketType);
      if (ticketPrice === undefined) {
        // Check dynamic configs first with day-wise pricing
        const config = ticketConfigs.find(c => c.ticketType === selection.ticketType);
        if (config && config.dayWisePricing.length > 0) {
          // Get current day name
          const today = new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
          const todayPricing = config.dayWisePricing.find(dp => dp.day === today && dp.enabled);
          
          if (todayPricing) {
            if (todayPricing.fixedAmount !== undefined) {
              ticketPrice = todayPricing.fixedAmount;
            } else {
              ticketPrice = Math.round(config.basePrice * todayPricing.priceMultiplier);
            }
          } else {
            ticketPrice = config.basePrice;
          }
        } else if (config) {
          ticketPrice = config.basePrice;
        } else {
          ticketPrice = getTicketPriceSync(selection.ticketType);
        }
        priceCacheRef.current.set(selection.ticketType, ticketPrice);
      }
      
      // Optimized calculation with minimal branching
      const hasKids = selection.ticketType !== '150' && selection.ticketType !== '100';
      const adults = selection.adults || 0;
      const kids = hasKids ? (selection.kids || 0) : 0;
      
      totalBaseAmount += adults * ticketPrice + kids * ticketPrice;
      totalKidDiscount += kids * 100;
      totalPeople += (selection.ticketType === '150' || selection.ticketType === '100') ? adults : adults + kids;
    }
    
    const finalAmount = Math.max(0, totalBaseAmount - totalKidDiscount);
    
    return {
      baseAmount: totalBaseAmount,
      kidDiscount: totalKidDiscount,
      finalAmount,
      totalPeople
    };
  }, [watchedSelections, selections, ticketConfigs]); // Removed watchedAdditionalDiscount to reduce re-calculations

  // Cleanup effect for performance optimizations
  useEffect(() => {
    return () => {
      if (calculationTrackerRef.current.timeoutId) {
        clearTimeout(calculationTrackerRef.current.timeoutId);
      }
    };
  }, []);

  // Simplified performance tracking - removed excessive logging
  useEffect(() => {
    setIsCalculating(false);
  }, [totalAmounts]);

  // Pre-cache all ticket prices on component mount for instant calculations
  useEffect(() => {
    const allTicketTypes: TicketType[] = ['150', '300', '450', '600', '100'];
    allTicketTypes.forEach(ticketType => {
      if (!priceCacheRef.current.has(ticketType)) {
        priceCacheRef.current.set(ticketType, getTicketPriceSync(ticketType));
      }
    });
  }, []);

  // Removed problematic config update effect to prevent infinite loops

  // Removed excessive instant update listener to improve performance

  const { fields, append, remove } = useFieldArray({ control, name: 'selections' });

  const onSubmit = (data: FormData) => {
    // Process each selection separately to maintain proper person allocation by ticket type
    const allSelections = data.selections.map(s => ({
      ticketType: s.ticketType as TicketType,
      adults: s.adults,
      kids: s.kids,
      adultsFastFoodCoupon: s.adultsFastFoodCoupon?.trim(),
      kidsFastFoodCoupon: s.kidsFastFoodCoupon?.trim(),
      adultsMainFoodCoupon: s.adultsMainFoodCoupon?.trim(),
      kidsMainFoodCoupon: s.kidsMainFoodCoupon?.trim(),
    }));

    // Use first selection as main, rest as upgrades
    const mainSelection = allSelections[0];
    const upgrades = allSelections.slice(1);

    const formData = {
      name: data.name.trim(),
      mobile: data.mobile.trim(),
      ticketType: mainSelection.ticketType,
      adults: mainSelection.adults,
      kids: mainSelection.kids,
      adultsFastFoodCoupon: mainSelection.adultsFastFoodCoupon,
      kidsFastFoodCoupon: mainSelection.kidsFastFoodCoupon,
      adultsMainFoodCoupon: mainSelection.adultsMainFoodCoupon,
      kidsMainFoodCoupon: mainSelection.kidsMainFoodCoupon,
      upgrades,
      filledBy: user?.username || 'Unknown',
    };

    // Trigger real-time sync event for dashboard and export
    window.dispatchEvent(new CustomEvent('entry-created', { 
      detail: { 
        action: 'create',
        timestamp: new Date().toISOString(),
        formData: formData
      } 
    }));

    useEntryStore.getState().setFormData(formData);
    useEntryStore.getState().setAmounts({
      baseAmount: totalAmounts.baseAmount,
      kidDiscount: totalAmounts.kidDiscount,
      additionalDiscount: watchedAdditionalDiscount as number,
      finalAmount: totalAmounts.finalAmount,
      totalPeople: totalAmounts.totalPeople,
    });
    navigate('/payment');
  };

  const addMoreSelection = () => {
    append({
      ticketType: '300',
      adults: 0,
      kids: 0,
      adultsFastFoodCoupon: '',
      kidsFastFoodCoupon: '',
      adultsMainFoodCoupon: '',
      kidsMainFoodCoupon: '',
    });
  };

  // Check if ticket type is 150 or 100 (no kids allowed)
  const is150Ticket = (ticketType: string) => ticketType === '150' || ticketType === '100';

  return (
    <Layout title="🎫 Ticket Entry Form">
      {/* Real-time Config Update Notification */}
      {configUpdateNotification && (
        <motion.div
          initial={{ opacity: 0, y: -50, scale: 0.8 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -50, scale: 0.8 }}
          className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 bg-gradient-to-r from-green-500 to-emerald-600 text-white px-6 py-3 rounded-xl shadow-2xl border-2 border-green-400 flex items-center gap-3"
        >
          <motion.div
            className="w-3 h-3 bg-white rounded-full animate-pulse"
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 1, repeat: Infinity }}
          />
          <span className="font-bold text-sm">{configUpdateNotification}</span>
          <motion.div
            className="w-4 h-4 bg-white bg-opacity-30 rounded-full"
            animate={{ scale: [1, 1.5, 1] }}
            transition={{ duration: 1, repeat: Infinity }}
          />
        </motion.div>
      )}
      
      {loadingConfigs || updatingConfigs ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">
              {updatingConfigs ? '🔄 Updating ticket configurations...' : 'Loading ticket configurations...'}
            </p>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
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

          {/* Day-wise Pricing Indicator */}
          {ticketConfigs.length > 0 && ticketConfigs.some(config => {
            // Get current day name
            const today = new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
            return config.dayWisePricing.some(dp => dp.day === today && dp.enabled && (dp.fixedAmount !== undefined || dp.priceMultiplier !== 1.0));
          }) && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-gradient-to-r from-blue-400 to-purple-500 text-white p-4 rounded-xl mb-6 border-2 border-blue-600 shadow-lg"
            >
              <div className="flex items-center justify-center">
                <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2-3-.895-3-2 1.343-2 3-2z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4V2m0 18v2m8-10h2M4 12H2" />
                </svg>
                <span className="font-bold text-lg">🎯 Special Day Pricing Active! Prices adjusted for today</span>
                <svg className="w-6 h-6 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2-3-.895-3-2 1.343-2 3-2z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4V2m0 18v2m8-10h2M4 12H2" />
                </svg>
              </div>
            </motion.div>
          )}

          {/* Customer Details */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="modern-card">
              <h2 className="heading-lg text-blue-900 mb-6">
                👤 Customer Information
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <motion.div whileHover={{ scale: 1.02 }}>
                  <label className="block text-blue-900 font-bold text-sm mb-2">
                    📝 Full Name *
                  </label>
                  <input
                    {...register('name')}
                    value={watch('name') || ''}
                    onChange={(e) => setValue('name', e.target.value)}
                    className="input-modern"
                    placeholder="Enter full name"
                  />
                  {errors.name && (
                    <p className="text-red-900 font-bold text-sm mt-2">❌ {errors.name.message}</p>
                  )}
                </motion.div>
                <motion.div whileHover={{ scale: 1.02 }}>
                  <label className="block text-blue-900 font-bold text-sm mb-2">
                    📱 Mobile Number *
                  </label>
                  <input
                    {...register('mobile')}
                    value={watch('mobile') || ''}
                    onChange={(e) => setValue('mobile', e.target.value)}
                    type="tel"
                    maxLength={10}
                    className="input-modern"
                    placeholder="10 digit number"
                  />
                  {errors.mobile && (
                    <p className="text-red-900 font-bold text-sm mt-2">❌ {errors.mobile.message}</p>
                  )}
                </motion.div>
              </div>
            </div>
          </motion.div>

          {/* Ticket Selections */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <div className="modern-card">
              <h2 className="heading-lg text-blue-900 mb-6">
                🎫 Ticket Selections
              </h2>

              {Array.isArray(fields) && fields.map((field, index) => (
                <motion.div
                  key={field.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="mb-6 p-6 bg-gradient-to-r from-blue-50 to-blue-100 rounded-2xl border-2 border-blue-200"
                >
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="heading-md text-blue-900">
                      Selection {index + 1}
                    </h3>
                    {index > 0 && (
                      <motion.button
                        type="button"
                        onClick={() => remove(index)}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white font-bold text-sm transition"
                      >
                        ❌ Remove
                      </motion.button>
                    )}
                  </div>

                  {/* Ticket Type */}
                  <div className="mb-4">
                    <label className="block text-blue-900 font-bold text-sm mb-2">
                      🎫 Type of Ticket *
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {Array.isArray(dynamicTicketOptions) && dynamicTicketOptions.map((t: { value: string; label: string; price: number; hasKids: boolean; description?: string }) => {
                        const currentPrice = getCurrentDayPrice(t.value);
                        const currentLabel = getCurrentDayLabel(t.value);
                        const basePrice = t.price;
                        const isSpecialPricing = currentPrice !== basePrice;
                        
                        return (
                          <motion.label
                            key={t.value}
                            whileHover={{ scale: 1.02 }}
                            className="flex items-center gap-3 p-3 rounded-xl bg-white border-2 border-blue-200 cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition"
                          >
                            <input
                              type="radio"
                              {...register(`selections.${index}.ticketType`)}
                              value={t.value}
                              className="w-5 h-5 accent-blue-600 cursor-pointer"
                            />
                            <div className="flex-1">
                              <div className="flex items-center justify-between">
                                <span className={`font-bold ${isSpecialPricing ? 'text-purple-900' : 'text-blue-900'}`}>
                                  ₹{currentPrice}
                                  {isSpecialPricing && (
                                    <span className="text-xs text-purple-600 ml-1">🎯</span>
                                  )}
                                </span>
                                <span className="text-blue-600 font-black text-sm">
                                  {t.hasKids ? 'Kids Allowed' : 'No Kids'}
                                </span>
                              </div>
                              <div className="text-blue-700 text-sm">{currentLabel}</div>
                              {isSpecialPricing && (
                                <div className="text-xs text-purple-600 mt-1">
                                  Special pricing for today (Regular: ₹{basePrice})
                                </div>
                              )}
                              {t.description && (
                                <div className="text-blue-600 text-xs mt-1">{t.description}</div>
                              )}
                            </div>
                          </motion.label>
                        );
                      })}
                    </div>
                  </div>

                  {/* Number of People */}
                  {is150Ticket(selections[index]?.ticketType) ? (
                    // 150 ticket: Only total person count
                    <motion.div whileHover={{ scale: 1.02 }}>
                      <label className="block text-blue-900 font-bold text-sm mb-2">
                        👥 Number of Persons *
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={30}
                        {...register(`selections.${index}.adults`, { valueAsNumber: true })}
                        value={selections[index]?.adults || ''}
                        onChange={(e) => setValue(`selections.${index}.adults`, Number(e.target.value) || 0)}
                        className="input-modern text-center"
                        placeholder="0"
                      />
                      <input
                        type="hidden"
                        {...register(`selections.${index}.kids`, { valueAsNumber: true })}
                        value={0}
                      />
                    </motion.div>
                  ) : (
                    // Other tickets: Adults and Kids separate
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <motion.div whileHover={{ scale: 1.02 }}>
                        <label className="block text-blue-900 font-bold text-sm mb-2">
                          👨 Number of Adults *
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={30}
                          {...register(`selections.${index}.adults`, { valueAsNumber: true })}
                          value={selections[index]?.adults || ''}
                          onChange={(e) => setValue(`selections.${index}.adults`, Number(e.target.value) || 0)}
                          className="input-modern text-center transition-all duration-150 focus:ring-2 focus:ring-blue-400 focus:scale-105"
                          placeholder="0"
                        />
                      </motion.div>
                      <motion.div whileHover={{ scale: 1.02 }}>
                        <label className="block text-blue-900 font-bold text-sm mb-2">
                          👧 Number of Kids *
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={30}
                          {...register(`selections.${index}.kids`, { valueAsNumber: true })}
                          value={selections[index]?.kids || ''}
                          onChange={(e) => setValue(`selections.${index}.kids`, Number(e.target.value) || 0)}
                          className="input-modern text-center transition-all duration-150 focus:ring-2 focus:ring-blue-400 focus:scale-105"
                          placeholder="0"
                        />
                      </motion.div>
                    </div>
                  )}

                  {/* Food Coupons for this selection - Show immediately when 450 or 600 is selected */}
                  {(selections[index]?.ticketType === '450' || selections[index]?.ticketType === '600') && (
                    <motion.div
                      initial={{ opacity: 0, y: 20, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ duration: 0.4, delay: 0.2 }}
                      className="mt-6"
                    >
                      <div className="modern-card bg-gradient-to-r from-green-50 to-blue-50 border-2 border-green-300 shadow-lg">
                        <div className="text-center mb-4">
                          <h3 className="heading-md text-blue-900 mb-2 flex items-center justify-center gap-2">
                            🍽️ Food Coupons (Optional)
                            <span className="text-xs bg-green-500 text-white px-2 py-1 rounded-full">
                              Available
                            </span>
                          </h3>
                          <p className="text-gray-600 text-sm">
                            Food coupons available for this ticket type
                          </p>
                        </div>
                        
                        {/* 450 Ticket - Fast Food Coupons */}
                        {selections[index]?.ticketType === '450' && (
                          <motion.div 
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.3 }}
                            className="p-4 rounded-xl border-2 bg-gradient-to-r from-orange-100 to-yellow-100 border-orange-300"
                          >
                            <div className="flex items-center gap-2 mb-3">
                              <div className="text-2xl">🍔</div>
                              <div>
                                <h4 className="text-orange-900 font-bold text-sm">
                                  ₹450 Ticket - Fast Food Coupons
                                </h4>
                                <p className="text-orange-700 text-xs">
                                  Enter coupon numbers for fast food redemption
                                </p>
                              </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                                <label className="block text-orange-900 font-bold text-xs mb-1">
                                  👨 Adults Fast Food Coupon No.
                                </label>
                                <input
                                  {...register(`selections.${index}.adultsFastFoodCoupon`)}
                                  value={selections[index]?.adultsFastFoodCoupon || ''}
                                  onChange={(e) => setValue(`selections.${index}.adultsFastFoodCoupon`, e.target.value)}
                                  className="input-modern border-2 border-orange-300 focus:border-orange-500 text-sm"
                                  placeholder="Adults fast food coupon"
                                />
                              </motion.div>
                              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                                <label className="block text-orange-900 font-bold text-xs mb-1">
                                  👧 Kids Fast Food Coupon No.
                                </label>
                                <input
                                  {...register(`selections.${index}.kidsFastFoodCoupon`)}
                                  value={selections[index]?.kidsFastFoodCoupon || ''}
                                  onChange={(e) => setValue(`selections.${index}.kidsFastFoodCoupon`, e.target.value)}
                                  className="input-modern border-2 border-orange-300 focus:border-orange-500 text-sm"
                                  placeholder="Kids fast food coupon"
                                />
                              </motion.div>
                            </div>
                          </motion.div>
                        )}

                        {/* 600 Ticket - Main Food Coupons */}
                        {selections[index]?.ticketType === '600' && (
                          <motion.div 
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.3 }}
                            className="p-4 rounded-xl border-2 bg-gradient-to-r from-green-100 to-emerald-100 border-green-300"
                          >
                            <div className="flex items-center gap-2 mb-3">
                              <div className="text-2xl">🍽️</div>
                              <div>
                                <h4 className="text-green-900 font-bold text-sm">
                                  ₹600 Ticket - Main Food Coupons
                                </h4>
                                <p className="text-green-700 text-xs">
                                  Enter coupon numbers for main food redemption
                                </p>
                              </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                                <label className="block text-green-900 font-bold text-xs mb-1">
                                  👨 Adults Main Food Coupon No.
                                </label>
                                <input
                                  {...register(`selections.${index}.adultsMainFoodCoupon`)}
                                  value={selections[index]?.adultsMainFoodCoupon || ''}
                                  onChange={(e) => setValue(`selections.${index}.adultsMainFoodCoupon`, e.target.value)}
                                  className="input-modern border-2 border-green-300 focus:border-green-500 text-sm"
                                  placeholder="Adults main food coupon"
                                />
                              </motion.div>
                              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                                <label className="block text-green-900 font-bold text-xs mb-1">
                                  👧 Kids Main Food Coupon No.
                                </label>
                                <input
                                  {...register(`selections.${index}.kidsMainFoodCoupon`)}
                                  value={selections[index]?.kidsMainFoodCoupon || ''}
                                  onChange={(e) => setValue(`selections.${index}.kidsMainFoodCoupon`, e.target.value)}
                                  className="input-modern border-2 border-green-300 focus:border-green-500 text-sm"
                                  placeholder="Kids main food coupon"
                                />
                              </motion.div>
                            </div>
                          </motion.div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </motion.div>
              ))}

              {/* Add More Selection Button */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.2 }}
                className="text-center"
              >
                <motion.button
                  type="button"
                  onClick={addMoreSelection}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white font-bold rounded-xl hover:from-blue-600 hover:to-purple-700 transition-all duration-300 shadow-lg"
                >
                  ➕ Add More Ticket Selection
                </motion.button>
              </motion.div>
            </div>
          </motion.div>

          {/* Config Update Notification */}
          <AnimatePresence>
            {configUpdateNotification && (
              <motion.div
                initial={{ opacity: 0, y: -50, scale: 0.8 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -50, scale: 0.8 }}
                className="fixed top-4 right-4 z-50 bg-gradient-to-r from-green-500 to-emerald-600 text-white px-6 py-4 rounded-xl shadow-2xl border-2 border-green-400"
              >
                <div className="flex items-center gap-3">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                    className="w-6 h-6 border-2 border-white border-t-transparent rounded-full"
                  />
                  <div>
                    <p className="font-bold text-lg">{configUpdateNotification}</p>
                    <p className="text-sm opacity-90">Prices updated in real-time!</p>
                  </div>
                  <button
                    onClick={() => setConfigUpdateNotification(null)}
                    className="ml-4 text-white hover:text-gray-200 text-xl leading-none"
                  >
                    ×
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Manual Refresh Button */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.3 }}
            className="text-center mb-4"
          >
            <motion.button
              type="button"
              onClick={() => {
                priceCacheRef.current.clear();
                fetchConfigs();
                setConfigUpdateNotification('🔄 Refreshing ticket prices...');
                setTimeout(() => setConfigUpdateNotification(null), 2000);
              }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="px-4 py-2 bg-gradient-to-r from-orange-500 to-red-600 text-white font-bold rounded-lg hover:from-orange-600 hover:to-red-700 transition-all duration-300 shadow-lg text-sm"
            >
              🔄 Refresh Ticket Prices
            </motion.button>
          </motion.div>

          {/* Total Amount Display */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.4 }}
            className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-xl border-2 border-blue-200"
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-blue-800">💰 Total Amount</h3>
              {lastCalculationTime > 0 && (
                <span className="text-xs text-gray-500">
                  ⚡ {lastCalculationTime.toFixed(1)}ms
                </span>
              )}
            </div>
            
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              key={`summary-${totalAmounts.finalAmount > 0 ? 'has-value' : 'empty'}`}
            >
              <div className="modern-card bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-300 relative overflow-hidden">
              {/* Performance and update indicators */}
              <div className="absolute top-2 right-2 flex items-center gap-2">
                {/* Calculation speed indicator */}
                {lastCalculationTime > 0 && (
                  <motion.div
                    className="text-xs text-green-600 font-medium bg-green-100 px-2 py-1 rounded-full"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.3 }}
                  >
                    ⚡ {lastCalculationTime.toFixed(1)}ms
                  </motion.div>
                )}
                
                {/* Live update indicator with pulse */}
                <motion.div
                  className="text-xs text-green-600 font-medium bg-green-100 px-2 py-1 rounded-full flex items-center gap-1"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: [0.5, 1, 0.5], scale: [0.95, 1, 0.95] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  Live
                </motion.div>
              </div>
              
              {/* Loading overlay for calculations */}
              {isCalculating && (
                <motion.div
                  className="absolute inset-0 bg-white bg-opacity-50 flex items-center justify-center z-10"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <div className="flex items-center gap-2 text-green-600">
                    <div className="w-4 h-4 border-2 border-green-600 border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-sm font-medium">Calculating...</span>
                  </div>
                </motion.div>
              )}
              
              <div className="text-center mb-6">
                <h3 className="heading-lg text-green-900 mb-4 flex items-center justify-center gap-2">
                  💵 Total Amount Calculation
                  {isCalculating && (
                    <motion.div
                      className="w-5 h-5 border-2 border-green-600 border-t-transparent rounded-full"
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    />
                  )}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <motion.div 
                    className="text-center relative"
                    key={`base-amount`}
                    initial={{ scale: 1 }}
                    animate={{ scale: [1, 1.05, 1] }}
                    transition={{ duration: 0.2 }}
                  >
                    {/* Quick change indicator */}
                    {totalAmounts.baseAmount > 0 && (
                      <motion.div
                        className="absolute -top-2 -right-2 w-3 h-3 bg-blue-500 rounded-full"
                        initial={{ scale: 0 }}
                        animate={{ scale: [0, 1.2, 1] }}
                        transition={{ duration: 0.3 }}
                      />
                    )}
                    <div className="text-sm text-gray-600 mb-1">Base Amount</div>
                    <div className="text-2xl font-bold text-gray-900">
                      ₹{totalAmounts.baseAmount.toLocaleString('en-IN')}
                    </div>
                  </motion.div>
                  <motion.div 
                    className="text-center relative"
                    key={`kid-discount`}
                    initial={{ scale: 1 }}
                    animate={{ scale: [1, 1.05, 1] }}
                    transition={{ duration: 0.2, delay: 0.1 }}
                  >
                    {/* Discount indicator */}
                    {totalAmounts.kidDiscount > 0 && (
                      <motion.div
                        className="absolute -top-2 -right-2 w-3 h-3 bg-green-500 rounded-full"
                        initial={{ scale: 0 }}
                        animate={{ scale: [0, 1.2, 1] }}
                        transition={{ duration: 0.3, delay: 0.1 }}
                      />
                    )}
                    <div className="text-sm text-gray-600 mb-1">Kid Discount</div>
                    <div className="text-2xl font-bold text-green-600">
                      -₹{totalAmounts.kidDiscount.toLocaleString('en-IN')}
                    </div>
                  </motion.div>
                  <motion.div 
                    className="text-center relative"
                    key={`final-amount`}
                    initial={{ scale: 1 }}
                    animate={{ scale: [1, 1.08, 1] }}
                    transition={{ duration: 0.3, delay: 0.2 }}
                  >
                    {/* Final amount highlight */}
                    <motion.div
                      className="absolute -top-1 -right-1 px-2 py-1 bg-gradient-to-r from-green-500 to-emerald-500 text-white text-xs rounded-full"
                      initial={{ scale: 0, rotate: -180 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ duration: 0.4, delay: 0.3 }}
                    >
                      Total
                    </motion.div>
                    <div className="text-sm text-gray-600 mb-1">Final Amount</div>
                    <div className="text-3xl font-bold text-green-700">
                      ₹{totalAmounts.finalAmount.toLocaleString('en-IN')}
                    </div>
                  </motion.div>
                </div>
                <div className="text-center mt-4">
                  <motion.div 
                    className="text-sm text-gray-600 mb-2"
                    key={`people-count`}
                    initial={{ opacity: 1 }}
                    animate={{ opacity: [1, 0.5, 1] }}
                    transition={{ duration: 0.3 }}
                  >
                    Total People: <span className="font-bold text-blue-900">{totalAmounts.totalPeople}</span>
                  </motion.div>
                  {watchedAdditionalDiscount > 0 && (
                    <div className="text-sm text-orange-600">
                      Additional Discount Applied: <span className="font-bold">₹{watchedAdditionalDiscount.toLocaleString('en-IN')}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
            </motion.div>
          </motion.div>

          {/* Submit Button */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="text-center"
          >
            <motion.button
              type="submit"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="px-8 py-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold text-lg rounded-xl hover:from-green-600 hover:to-emerald-700 transition-all duration-300 shadow-xl"
            >
              ✅ Proceed to Payment →
            </motion.button>
          </motion.div>
        </form>
      )}
    </Layout>
  );
}
