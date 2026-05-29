const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, index: true },
  password: { type: String, required: true, minlength: 6 },
  role: { type: String, enum: ['admin', 'staff'], default: 'staff' },
  active: { type: Boolean, default: true },
  email: { type: String },
  fullName: { type: String },
  firebaseUid: { type: String, unique: true, sparse: true },
  loginLogs: [{ timestamp: { type: Date, default: Date.now }, success: { type: Boolean, required: true } }],
}, { timestamps: true });

// Password hashing middleware
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  try {
    this.password = await bcrypt.hash(this.password, 12);
    next();
  } catch (error) {
    console.error('Password hashing error:', error);
    next(error);
  }
});

// Password comparison method
userSchema.methods.comparePassword = async function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

// Static methods for user operations
userSchema.statics.findByUsername = function (username) {
  return this.findOne({ username: username.trim() });
};

const User = mongoose.model('User', userSchema);

module.exports = { User };
