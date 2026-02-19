import mongoose, { Document, Schema } from 'mongoose';
import bcrypt from 'bcryptjs';

export type Role = 'admin' | 'staff';

export interface IUser extends Document {
  username: string;
  password: string;
  role: Role;
  active: boolean;
  email?: string;
  fullName?: string;
  loginLogs: { timestamp: Date; success: boolean }[];
  createdAt: Date;
  comparePassword(candidate: string): Promise<boolean>;
}

const userSchema = new Schema<IUser>(
  {
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['admin', 'staff'], required: true },
    active: { type: Boolean, default: true },
    email: { type: String, sparse: true, unique: true },
    fullName: { type: String },
    loginLogs: [
      {
        timestamp: { type: Date, default: Date.now },
        success: Boolean,
      },
    ],
  },
  { timestamps: true }
);

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = function (candidate: string): Promise<boolean> {
  return bcrypt.compare(candidate, this.password);
};

export const User = mongoose.model<IUser>('User', userSchema);
