const mongoose = require('mongoose');

const DayWisePricingSchema = new mongoose.Schema({
  day: { type: String, required: true, enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] },
  priceMultiplier: { type: Number, default: 1.0, min: 0, max: 5 },
  fixedAmount: { type: Number, min: 0 },
  enabled: { type: Boolean, default: true }
});

const TicketConfigSchema = new mongoose.Schema({
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
  if (this.isNew && (!this.dayWisePricing || this.dayWisePricing.length === 0)) {
    this.dayWisePricing = [
      { day: 'monday', priceMultiplier: 1.0, enabled: true },
      { day: 'tuesday', priceMultiplier: 1.0, enabled: true },
      { day: 'wednesday', priceMultiplier: 1.0, enabled: true },
      { day: 'thursday', priceMultiplier: 1.0, enabled: true },
      { day: 'friday', priceMultiplier: 1.0, enabled: true },
      { day: 'saturday', priceMultiplier: 1.0, enabled: true },
      { day: 'sunday', priceMultiplier: 1.0, enabled: true }
    ];
  }
  next();
});

const TicketConfig = mongoose.model('TicketConfig', TicketConfigSchema);

module.exports = { TicketConfig };
