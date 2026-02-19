import mongoose, { Document, Schema } from 'mongoose';

export type TicketType =
  | '150'  // Without Food 1hr
  | '300'  // Without Food 3-4hr
  | '450'  // With Fast Food
  | '600'  // With Main Food
  | '100'; // Sitting Only

export interface IUpgrade {
  ticketType: TicketType;
  adults: number;
  kids: number;
  adultsFastFoodCoupon?: string;
  kidsFastFoodCoupon?: string;
  adultsMainFoodCoupon?: string;
  kidsMainFoodCoupon?: string;
}

export interface IEntry extends Document {
  name: string;
  mobile: string;
  ticketType: TicketType;
  adults: number;
  kids: number;
  upgrades: IUpgrade[];
  // Food coupons (for 450/600)
  adultsFastFoodCoupon?: string;
  kidsFastFoodCoupon?: string;
  adultsMainFoodCoupon?: string;
  kidsMainFoodCoupon?: string;
  totalPeople: number;
  baseAmount: number;
  kidDiscount: number; // ₹100 per kid
  additionalDiscount: number;
  finalAmount: number;
  cashAmount: number;
  upiAmount: number;
  advanceAmount: number;
  otherAmount: number;
  notes?: string;
  filledByFullName?: string; // Full name of person who filled the form
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
}

const upgradeSchema = new Schema<IUpgrade>(
  {
    ticketType: { type: String, enum: ['150', '300', '450', '600', '100'], required: true },
    adults: { type: Number, default: 0 },
    kids: { type: Number, default: 0 },
    adultsFastFoodCoupon: String,
    kidsFastFoodCoupon: String,
    adultsMainFoodCoupon: String,
    kidsMainFoodCoupon: String,
  },
  { _id: false }
);

const entrySchema = new Schema<IEntry>(
  {
    name: { type: String, required: true },
    mobile: { type: String, required: true },
    ticketType: { type: String, enum: ['150', '300', '450', '600', '100'], required: true },
    adults: { type: Number, required: true, min: 0 },
    kids: { type: Number, required: true, min: 0 },
    upgrades: [upgradeSchema],
    adultsFastFoodCoupon: String,
    kidsFastFoodCoupon: String,
    adultsMainFoodCoupon: String,
    kidsMainFoodCoupon: String,
    totalPeople: { type: Number, required: true },
    baseAmount: { type: Number, required: true },
    kidDiscount: { type: Number, default: 0 },
    additionalDiscount: { type: Number, default: 0 },
    finalAmount: { type: Number, required: true },
    cashAmount: { type: Number, required: true },
    upiAmount: { type: Number, required: true },
    advanceAmount: { type: Number, default: 0 },
    otherAmount: { type: Number, default: 0 },
    notes: String,
    filledByFullName: String, // Full name of person who filled the form
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

entrySchema.index({ createdAt: -1 });
entrySchema.index({ name: 'text', mobile: 'text' });

export const Entry = mongoose.model<IEntry>('Entry', entrySchema);
