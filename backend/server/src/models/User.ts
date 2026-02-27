import mongoose, { Schema, Document } from 'mongoose';
import bcrypt from 'bcryptjs';

export interface IUser extends Document {
  username: string;
  password: string;
  role: 'admin' | 'staff';
  active: boolean;
  email?: string;
  fullName?: string;
  loginLogs: Array<{ timestamp: Date; success: boolean }>;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidate: string): Promise<boolean>;
}

const userSchema = new Schema<IUser>(
  {
    username: { type: String, required: true, unique: true, index: true },
    password: { type: String, required: true, minlength: 6 },
    role: { type: String, enum: ['admin', 'staff'], default: 'staff' },
    active: { type: Boolean, default: true },
    email: { type: String },
    fullName: { type: String },
    loginLogs: [{ timestamp: { type: Date, default: Date.now }, success: { type: Boolean, required: true } }],
  },
  { timestamps: true }
);

// Password hashing middleware
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  try {
    this.password = await bcrypt.hash(this.password, 12);
    next();
  } catch (error: any) {
    console.error('Password hashing error:', error);
    next(error);
  }
});

// Password comparison method
userSchema.methods.comparePassword = async function (candidate: string): Promise<boolean> {
  return bcrypt.compare(candidate, this.password);
};

// Static methods for user operations
userSchema.statics.findByUsername = function (username) {
  return this.findOne({ username: username.trim() });
};

userSchema.statics.findActiveUsers = function () {
  return this.find({ active: true });
};

// Virtual for user profile
userSchema.virtual('profile').get(function () {
  return {
    id: this._id,
    username: this.username,
    fullName: this.fullName,
    role: this.role,
    active: this.active,
    email: this.email
  };
});

// Ensure virtuals are included in JSON output
userSchema.set('toJSON', { virtuals: true });
userSchema.set('toObject', { virtuals: true });

export const User = mongoose.model<IUser>('User', userSchema);
export type UserDocument = IUser;
