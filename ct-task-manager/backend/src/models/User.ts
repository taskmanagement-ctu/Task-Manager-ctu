import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  universityId: string;
  name: string;
  email: string;
  phone: string;
  department: string | null;
  baseDepartment?: string | null;
  passwordHash: string;
  role: 'super_admin' | 'department_admin' | 'staff';
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    universityId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
    },
    department: {
      type: String,
      default: null,
      trim: true,
    },
    baseDepartment: {
      type: String,
      default: null,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: ['super_admin', 'department_admin', 'staff'],
      default: 'staff',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

export const PRIMARY_SUPER_ADMIN_ID = '10001';

const User = mongoose.model<IUser>('User', userSchema, 'users');

export default User;

