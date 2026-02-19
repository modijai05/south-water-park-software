import mongoose, { Schema, Document } from 'mongoose';

export interface DayWisePricing {
  day: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
  priceMultiplier: number; // 1.0 = normal, 1.5 = 50% increase, 0.5 = 50% discount
  fixedAmount?: number; // If set, overrides multiplier
  enabled: boolean;
}

export interface ITicketConfig extends Document {
  ticketType: '100' | '150' | '300' | '450' | '600';
  basePrice: number;
  label: string;
  hasKids: boolean;
  description: string;
  dayWisePricing: DayWisePricing[];
  isActive: boolean;
  maxAdults?: number;
  maxKids?: number;
  timeLimit?: number; // in hours
  foodIncluded?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const DayWisePricingSchema = new Schema<DayWisePricing>({
  day: { type: String, required: true, enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] },
  priceMultiplier: { type: Number, default: 1.0, min: 0, max: 5 },
  fixedAmount: { type: Number, min: 0 },
  enabled: { type: Boolean, default: true }
});

const TicketConfigSchema = new Schema<ITicketConfig>({
  ticketType: { type: String, required: true, enum: ['100', '150', '300', '450', '600'], unique: true },
  basePrice: { type: Number, required: true, min: 0 },
  label: { type: String, required: true },
  hasKids: { type: Boolean, default: true },
  description: { type: String, required: true },
  dayWisePricing: [DayWisePricingSchema],
  isActive: { type: Boolean, default: true },
  maxAdults: { type: Number, min: 1 },
  maxKids: { type: Number, min: 0 },
  timeLimit: { type: Number, min: 0 }, // in hours
  foodIncluded: { type: Boolean, default: false }
}, {
  timestamps: true
});

// Create default day-wise pricing for new tickets
TicketConfigSchema.pre('save', function(next) {
  if (this.isNew && !this.dayWisePricing.length) {
    const days: DayWisePricing['day'][] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    this.dayWisePricing = days.map(day => ({
      day,
      priceMultiplier: 1.0,
      enabled: true
    }));
  }
  next();
});

export const TicketConfig = mongoose.model<ITicketConfig>('TicketConfig', TicketConfigSchema);
