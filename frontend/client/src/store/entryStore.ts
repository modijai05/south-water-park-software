import { create } from 'zustand';
import type { EntryFormData, PaymentFormData } from '@/types';

interface EntryState {
  formData: EntryFormData | null;
  paymentData: PaymentFormData | null;
  baseAmount: number;
  kidDiscount: number;
  additionalDiscount: number;
  finalAmount: number;
  totalPeople: number;
  setFormData: (d: EntryFormData | null) => void;
  setPaymentData: (d: PaymentFormData | null) => void;
  setAmounts: (p: {
    baseAmount: number;
    kidDiscount: number;
    additionalDiscount: number;
    finalAmount: number;
    totalPeople: number;
  }) => void;
  clearFoodCoupons: () => void;
  clear: () => void;
}

export const useEntryStore = create<EntryState>((set) => ({
  formData: null,
  paymentData: null,
  baseAmount: 0,
  kidDiscount: 0,
  additionalDiscount: 0,
  finalAmount: 0,
  totalPeople: 0,
  setFormData: (formData) => set({ formData }),
  setPaymentData: (paymentData) => set({ paymentData }),
  setAmounts: (p) => set(p),
  clearFoodCoupons: () =>
    set((state) => ({
      formData: state.formData
        ? {
            ...state.formData,
            adultsFastFoodCoupon: undefined,
            kidsFastFoodCoupon: undefined,
            adultsMainFoodCoupon: undefined,
            kidsMainFoodCoupon: undefined,
          }
        : null,
    })),
  clear: () =>
    set({
      formData: null,
      paymentData: null,
      baseAmount: 0,
      kidDiscount: 0,
      additionalDiscount: 0,
      finalAmount: 0,
      totalPeople: 0,
    }),
}));
