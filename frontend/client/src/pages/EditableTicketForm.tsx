import { useMemo, useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { useFieldArray } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Layout } from '@/components/Layout';
import { useEntryStore } from '@/store/entryStore';
import { useAuthStore } from '@/store/authStore';
import { InlineEditableField } from '@/components/InlineEditableField';
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
    // 150 tickets don't allow kids
    if (data.ticketType === '150' && data.kids > 0) return false;
    
    return true;
  },
  {
    message: "Invalid selection: 150 tickets don't allow kids",
    path: ['adults']
  }
);

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  mobile: z.string().min(10, 'Valid mobile required').regex(/^\d{10}$/, '10 digits only'),
  selections: z.array(ticketSelectionSchema).min(1, 'At least one ticket selection is required'),
  additionalDiscount: z.number().min(0, 'Additional discount must be 0 or more').optional(),
});

type FormData = z.infer<typeof schema>;

const defaultValues: FormData = {
  name: '',
  mobile: '',
  selections: [
    {
      ticketType: '300',
      adults: 0,
      kids: 0,
      adultsFastFoodCoupon: '',
      kidsFastFoodCoupon: '',
      adultsMainFoodCoupon: '',
      kidsMainFoodCoupon: '',
    }
  ],
  additionalDiscount: 0,
};

export function EditableTicketForm() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { formData } = useEntryStore();
  const [ticketConfigs, setTicketConfigs] = useState<TicketConfig[]>([]);
  const [loadingConfigs, setLoadingConfigs] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [realTimeSync, setRealTimeSync] = useState(true);
  
  // Performance optimization: Price cache to avoid repeated calculations
  const priceCacheRef = useRef<Map<TicketType, number>>(new Map());
  const calculationTimeoutRef = useRef<NodeJS.Timeout>();
  const [isCalculating, setIsCalculating] = useState(false);
  const [lastCalculationTime, setLastCalculationTime] = useState(0);
  
  // Fetch ticket configurations
  const fetchConfigs = async () => {
    try {
      const configs = await ticketConfigApi.getAll();
      setTicketConfigs(configs);
    } catch (error) {
      console.error('Failed to fetch ticket configs:', error);
    } finally {
      setLoadingConfigs(false);
    }
  };

  // Fetch ticket configurations on mount and setup real-time sync
  useEffect(() => {
    fetchConfigs();
    
    // Listen for real-time ticket configuration updates
    const handleTicketConfigUpdate = async (event: CustomEvent) => {
      console.log('🔄 EditableTicketForm: Received ticket config update', event.detail);
      
      try {
        // Clear price cache to force fresh calculations
        priceCacheRef.current.clear();
        
        // Fetch updated configs
        await fetchConfigs();
        
        console.log('✅ EditableTicketForm: Configs updated successfully');
      } catch (error) {
        console.error('Error handling ticket config update in EditableTicketForm:', error);
      }
    };
    
    window.addEventListener('ticket-config-updated', handleTicketConfigUpdate as unknown as EventListener);
    
    return () => {
      window.removeEventListener('ticket-config-updated', handleTicketConfigUpdate as unknown as EventListener);
    };
  }, []);

  // Dynamic ticket options based on admin configuration
  const dynamicTicketOptions = useMemo(() => {
    if (ticketConfigs.length === 0) {
      return [
        { value: '150' as TicketType, label: '₹150 – Without Food (1 Hour)', price: 150, hasKids: false },
        { value: '300' as TicketType, label: '₹350 – Without Food (3–4 Hours)', price: 350, hasKids: true },
        { value: '450' as TicketType, label: '₹500 – With Fast Food (3–4 Hours)', price: 500, hasKids: true },
        { value: '600' as TicketType, label: '₹700 – With Main Food (4–5 Hours)', price: 700, hasKids: true },
        { value: '100' as TicketType, label: 'Special ticket with Sitting Only', price: 100, hasKids: true },
      ];
    }

    return ticketConfigs
      .filter(config => config.isActive)
      .map(config => ({
        value: config.ticketType,
        label: config.label,
        price: config.basePrice,
        hasKids: config.hasKids,
        description: config.description
      }));
  }, [ticketConfigs]);

  const {
    register,
    watch,
    control,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    getValues,
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues,
  });

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
  const additionalDiscount = watch('additionalDiscount') || 0;

  // Removed real-time sync interval to improve performance

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

  // Optimized instant calculation with caching
  const calculateInstantAmount = useCallback((ticketType: TicketType, adults: number, kids: number) => {
    // Use cached price to avoid repeated lookups
    if (!priceCacheRef.current.has(ticketType)) {
      priceCacheRef.current.set(ticketType, getTicketPriceSync(ticketType));
    }
    const ticketPrice = priceCacheRef.current.get(ticketType)!;
    
    const hasKids = ticketType !== '150';
    const baseAmount = adults * ticketPrice + (hasKids ? kids * ticketPrice : 0);
    const kidDiscount = hasKids ? kids * 50 : 0;
    const finalAmount = Math.max(0, baseAmount - kidDiscount);
    const people = ticketType === '150' ? adults : adults + (hasKids ? kids : 0);
    
    return { baseAmount, kidDiscount, finalAmount, people };
  }, []);

  // Optimized total calculation with debouncing
  const totalAmounts = useMemo(() => {
    let totalBaseAmount = 0;
    let totalKidDiscount = 0;
    let totalPeople = 0;

    // Pre-populate price cache for all ticket types at once
    const uniqueTicketTypes = new Set<TicketType>();
    if (selections && Array.isArray(selections)) {
      const safeSelections = Array.isArray(selections) ? selections : [];
      safeSelections.forEach((selection) => {
        if (selection && (selection.adults > 0 || selection.kids > 0)) {
          uniqueTicketTypes.add(selection.ticketType);
        }
      });
    }
    
    // Batch fetch prices for cache
    const uniqueTypesArray = Array.from(uniqueTicketTypes);
    const safeUniqueTypes = Array.isArray(uniqueTypesArray) ? uniqueTypesArray : [];
    safeUniqueTypes.forEach(ticketType => {
      if (ticketType && !priceCacheRef.current.has(ticketType)) {
        priceCacheRef.current.set(ticketType, getTicketPriceSync(ticketType));
      }
    });
    
    // Fast calculation loop with cached prices
    if (selections && Array.isArray(selections)) {
      const safeSelections = Array.isArray(selections) ? selections : [];
      safeSelections.forEach((selection) => {
      if (!selection || (selection.adults === 0 && selection.kids === 0)) return;
      
      // Special handling for 150 tickets (no kids allowed)
      if (selection.ticketType === '150' && selection.kids > 0) return;
      
      // Get cached price
      const ticketPrice = priceCacheRef.current.get(selection.ticketType)!;
      
      // Inline calculation for maximum performance
      const hasKids = selection.ticketType !== '150';
      const selectionBaseAmount = selection.adults * ticketPrice + 
        (hasKids ? selection.kids * ticketPrice : 0);
      
      const selectionPeople = selection.ticketType === '150' 
        ? selection.adults 
        : selection.adults + (hasKids ? selection.kids : 0);
      
      const selectionKidCount = hasKids ? selection.kids : 0;
      const selectionKidDiscount = selectionKidCount * 50;
      
      // Accumulate totals
      totalBaseAmount += selectionBaseAmount;
      totalKidDiscount += selectionKidDiscount;
      totalPeople += selectionPeople;
      });
    }

    const finalAmount = Math.max(0, totalBaseAmount - totalKidDiscount - additionalDiscount);

    // Simplified loading state
    setIsCalculating(false);

    return {
      baseAmount: totalBaseAmount,
      kidDiscount: totalKidDiscount,
      finalAmount,
      totalPeople,
    };
  }, [selections, additionalDiscount]);

  // Simplified cleanup effect

  // Pre-cache all ticket prices on component mount for instant calculations
  useEffect(() => {
    const allTicketTypes: TicketType[] = ['150', '300', '450', '600', '100'];
    if (Array.isArray(allTicketTypes)) {
      allTicketTypes.forEach(ticketType => {
        if (ticketType && !priceCacheRef.current.has(ticketType)) {
          priceCacheRef.current.set(ticketType, getTicketPriceSync(ticketType));
        }
      });
    }
  }, []);

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
      additionalDiscount: data.additionalDiscount || 0,
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
      additionalDiscount: additionalDiscount,
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

  // Check if ticket type is 150 (no kids allowed)
  const is150Ticket = (ticketType: string) => ticketType === '150';

  // Update field value
  const updateFieldValue = (fieldPath: string, value: any) => {
    setValue(fieldPath as any, value);
    // Trigger real-time sync
    window.dispatchEvent(new CustomEvent('field-updated', { 
      detail: { fieldPath, value }
    }));
  };

  return (
    <Layout title="🎫 Editable Ticket Form">
      {loadingConfigs ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading ticket configurations...</p>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Edit Mode Toggle */}
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold text-gray-900">
              🎫 Professional Ticket Form Editor
            </h1>
            <div className="flex items-center space-x-4">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={editMode}
                  onChange={(e) => setEditMode(e.target.checked)}
                  className="mr-2"
                />
                <span className="text-sm font-medium">Edit Mode</span>
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={realTimeSync}
                  onChange={(e) => setRealTimeSync(e.target.checked)}
                  className="mr-2"
                />
                <span className="text-sm font-medium">Real-time Sync</span>
              </label>
            </div>
          </div>

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
                <div>
                  <InlineEditableField
                    label="📝 Full Name *"
                    value={watch('name')}
                    onChange={(value) => updateFieldValue('name', value)}
                    placeholder="Enter full name"
                    disabled={!editMode}
                    icon="📝"
                  />
                  {errors.name && (
                    <p className="text-red-900 font-bold text-sm mt-2">❌ {errors.name.message}</p>
                  )}
                </div>
                <div>
                  <InlineEditableField
                    label="📱 Mobile Number *"
                    value={watch('mobile')}
                    onChange={(value) => updateFieldValue('mobile', value)}
                    placeholder="10 digit number"
                    disabled={!editMode}
                    icon="📱"
                  />
                  {errors.mobile && (
                    <p className="text-red-900 font-bold text-sm mt-2">❌ {errors.mobile.message}</p>
                  )}
                </div>
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

              {fields.map((field, index) => (
                <motion.div
                  key={field.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className={`mb-6 p-6 rounded-2xl border-2 transition-all duration-200 ${
                    editMode ? 'bg-yellow-50 border-yellow-300' : 'bg-gradient-to-r from-blue-50 to-blue-100 border-blue-200'
                  }`}
                >
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="heading-md text-blue-900">
                      Selection {index + 1}
                    </h3>
                    <div className="flex items-center space-x-2">
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
                      {editMode && (
                        <div className="text-xs bg-yellow-500 text-white px-2 py-1 rounded-full">
                          Edit Mode Active
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Ticket Type */}
                  <div className="mb-4">
                    <label className="block text-blue-900 font-bold text-sm mb-2">
                      🎫 Type of Ticket *
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {dynamicTicketOptions.map((t: { value: string; label: string; price: number; hasKids: boolean; description?: string }) => {
                        const currentPrice = getTicketPriceSync(t.value as TicketType);
                        const currentLabel = getTicketLabelSync(t.value as TicketType);
                        const isSelected = selections[index]?.ticketType === t.value;
                        
                        return (
                          <motion.label
                            key={t.value}
                            whileHover={{ scale: 1.02 }}
                            className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition ${
                              isSelected 
                                ? 'bg-blue-100 border-blue-500' 
                                : 'bg-white border-gray-200 hover:border-blue-400 hover:bg-blue-50'
                            }`}
                          >
                            <input
                              type="radio"
                              {...register(`selections.${index}.ticketType`)}
                              value={t.value}
                              className="w-5 h-5 accent-blue-600 cursor-pointer"
                            />
                            <div className="flex-1">
                              <div className="flex items-center justify-between">
                                <span className="text-blue-900 font-bold">₹{currentPrice}</span>
                                <span className="text-blue-600 font-black text-sm">
                                  {t.hasKids ? 'Kids Allowed' : 'No Kids'}
                                </span>
                              </div>
                              <div className="text-blue-700 text-sm">{currentLabel.replace('₹' + currentPrice + ' – ', '')}</div>
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
                    <div>
                      <InlineEditableField
                        label="👥 Number of Persons *"
                        value={selections[index]?.adults || 0}
                        onChange={(value) => updateFieldValue(`selections.${index}.adults`, value)}
                        type="number"
                        placeholder="0"
                        disabled={!editMode}
                        icon="👥"
                      />
                      <input
                        type="hidden"
                        {...register(`selections.${index}.kids`, { valueAsNumber: true })}
                        value={0}
                      />
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <InlineEditableField
                        label="👨 Number of Adults *"
                        value={selections[index]?.adults || 0}
                        onChange={(value) => updateFieldValue(`selections.${index}.adults`, value)}
                        type="number"
                        placeholder="0"
                        disabled={!editMode}
                        icon="👨"
                      />
                      <InlineEditableField
                        label="👧 Number of Kids *"
                        value={selections[index]?.kids || 0}
                        onChange={(value) => updateFieldValue(`selections.${index}.kids`, value)}
                        type="number"
                        placeholder="0"
                        disabled={!editMode}
                        icon="👧"
                      />
                    </div>
                  )}

                  {/* Food Coupons for this selection */}
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
                                  ₹500 Ticket - Fast Food Coupons
                                </h4>
                                <p className="text-orange-700 text-xs">
                                  Enter coupon numbers for fast food redemption
                                </p>
                              </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <InlineEditableField
                                label="👨 Adults Fast Food Coupon No."
                                value={selections[index]?.adultsFastFoodCoupon || ''}
                                onChange={(value) => updateFieldValue(`selections.${index}.adultsFastFoodCoupon`, value)}
                                placeholder="Adults fast food coupon"
                                disabled={!editMode}
                              />
                              <InlineEditableField
                                label="👧 Kids Fast Food Coupon No."
                                value={selections[index]?.kidsFastFoodCoupon || ''}
                                onChange={(value) => updateFieldValue(`selections.${index}.kidsFastFoodCoupon`, value)}
                                placeholder="Kids fast food coupon"
                                disabled={!editMode}
                              />
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
                                  ₹700 Ticket - Main Food Coupons
                                </h4>
                                <p className="text-green-700 text-xs">
                                  Enter coupon numbers for main food redemption
                                </p>
                              </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <InlineEditableField
                                label="👨 Adults Main Food Coupon No."
                                value={selections[index]?.adultsMainFoodCoupon || ''}
                                onChange={(value) => updateFieldValue(`selections.${index}.adultsMainFoodCoupon`, value)}
                                placeholder="Adults main food coupon"
                                disabled={!editMode}
                              />
                              <InlineEditableField
                                label="👧 Kids Main Food Coupon No."
                                value={selections[index]?.kidsMainFoodCoupon || ''}
                                onChange={(value) => updateFieldValue(`selections.${index}.kidsMainFoodCoupon`, value)}
                                placeholder="Kids main food coupon"
                                disabled={!editMode}
                              />
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

          {/* Additional Discount */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <div className="modern-card">
              <h2 className="heading-lg text-blue-900 mb-6">
                💰 Additional Discount (Optional)
              </h2>
              <InlineEditableField
                label="💸 Discount Amount"
                value={additionalDiscount}
                onChange={(value) => updateFieldValue('additionalDiscount', value)}
                type="number"
                placeholder="Enter additional discount amount"
                disabled={!editMode}
                icon="💸"
              />
              <p className="text-gray-600 text-sm mt-2">
                Enter any additional discount amount to be applied to the total
              </p>
            </div>
          </motion.div>

          {/* Total Amount Display */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <div className="modern-card bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-300">
              <div className="text-center mb-6">
                <h3 className="heading-lg text-green-900 mb-4">
                  💵 Total Amount Calculation
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="text-center">
                    <div className="text-sm text-gray-600 mb-1">Base Amount</div>
                    <div className="text-2xl font-bold text-gray-900">
                      ₹{totalAmounts.baseAmount.toLocaleString('en-IN')}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm text-gray-600 mb-1">Kid Discount</div>
                    <div className="text-2xl font-bold text-green-600">
                      -₹{totalAmounts.kidDiscount.toLocaleString('en-IN')}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm text-gray-600 mb-1">Final Amount</div>
                    <div className="text-3xl font-bold text-green-700">
                      ₹{totalAmounts.finalAmount.toLocaleString('en-IN')}
                    </div>
                  </div>
                </div>
                <div className="text-center mt-4">
                  <div className="text-sm text-gray-600 mb-2">
                    Total People: <span className="font-bold text-blue-900">{totalAmounts.totalPeople}</span>
                  </div>
                  {additionalDiscount > 0 && (
                    <div className="text-sm text-orange-600">
                      Additional Discount Applied: <span className="font-bold">₹{additionalDiscount.toLocaleString('en-IN')}</span>
                    </div>
                  )}
                  {realTimeSync && (
                    <div className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full inline-block">
                      🔄 Real-time Sync Active
                    </div>
                  )}
                </div>
              </div>
            </div>
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
              onClick={handleSubmit(onSubmit)}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="px-8 py-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold text-lg rounded-xl hover:from-green-600 hover:to-emerald-700 transition-all duration-300 shadow-xl"
            >
              ✅ Proceed to Payment →
            </motion.button>
          </motion.div>
        </div>
      )}
    </Layout>
  );
}
