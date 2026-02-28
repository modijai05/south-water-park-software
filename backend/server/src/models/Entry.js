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
  finalAmount: { type: Number, required: true },
  cashAmount: { type: Number, default: 0 },
  upiAmount: { type: Number, default: 0 },
  advanceAmount: { type: Number, default: 0 },
  otherAmount: { type: Number, default: 0 },
  kidDiscount: { type: Number, default: 0 },
  additionalDiscount: { type: Number, default: 0 },
  adultsFastFoodCoupon: String,
  kidsFastFoodCoupon: String,
  adultsMainFoodCoupon: String,
  kidsMainFoodCoupon: String,
  upgrades: [upgradeSchema],
  notes: String,
  filledByFullName: String,
  receiptNumber: { type: String, unique: true, sparse: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

entrySchema.index({ createdAt: -1 });
entrySchema.index({ name: 'text', mobile: 'text' });

const Entry = mongoose.model('Entry', entrySchema);

module.exports = { Entry };
