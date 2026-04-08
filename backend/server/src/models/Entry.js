const mongoose = require('mongoose');

const upgradeSchema = new mongoose.Schema({
  ticketType: { type: String, required: true },
  adults: { type: Number, default: 0 },
  kids: { type: Number, default: 0 },
  adultsFastFoodCoupon: String,
  kidsFastFoodCoupon: String,
  adultsMainFoodCoupon: String,
  kidsMainFoodCoupon: String,
});

const entrySchema = new mongoose.Schema({
  name: { type: String, required: true },
  mobile: { type: String, required: true },
  ticketType: { 
    type: String, 
    required: true,
    enum: ['150', '300', '450', '600', '100']
  },
  adults: { type: Number, required: true, default: 0 },
  kids: { type: Number, required: true, default: 0 },
  totalPeople: { type: Number, required: true },
  baseAmount: { type: Number, default: 0 },
  kidDiscount: { type: Number, default: 0 },
  additionalDiscount: { type: Number, default: 0 },
  finalAmount: { type: Number, required: true },
  cashAmount: { type: Number, default: 0 },
  upiAmount: { type: Number, default: 0 },
  advanceAmount: { type: Number, default: 0 },
  otherAmount: { type: Number, default: 0 },
  adultsFastFoodCoupon: { type: String, default: '' },
  kidsFastFoodCoupon: { type: String, default: '' },
  adultsMainFoodCoupon: { type: String, default: '' },
  kidsMainFoodCoupon: { type: String, default: '' },
  upgrades: [upgradeSchema],
  notes: { type: String, default: '' },
  filledBy: { type: String, default: 'Unknown' },
  filledByFullName: { type: String, default: 'Unknown' },
  receiptNumber: { type: String, unique: true, sparse: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  // Custom entry date field that can be manually updated
  entryDate: { type: Date, default: Date.now },
}, { timestamps: true });

// Pre-save hook to ensure entryDate is properly set
entrySchema.pre('save', function(next) {
  if (this.isModified('entryDate') && this.entryDate) {
    console.log('🔧 Entry Model: entryDate being set to:', this.entryDate);
  }
  next();
});

entrySchema.index({ createdAt: -1 });
entrySchema.index({ entryDate: -1 });
entrySchema.index({ name: 'text', mobile: 'text' });
entrySchema.index({ ticketType: 1 });
entrySchema.index({ filledBy: 1 });
entrySchema.index({ finalAmount: 1 });
entrySchema.index({ createdBy: 1 });
// Compound index for date-wise queries
entrySchema.index({ createdAt: -1, ticketType: 1 });
entrySchema.index({ entryDate: -1, ticketType: 1 });
// Compound index for search optimization
entrySchema.index({ name: 1, mobile: 1, receiptNumber: 1 });

const Entry = mongoose.model('Entry', entrySchema);

module.exports = { Entry };
