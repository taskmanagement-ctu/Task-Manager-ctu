import mongoose, { Schema, Document } from 'mongoose';

export interface IVerifiedUser extends Document {
  universityId: string;
  name: string;
  email: string;
  phone: string;
  department: string | null;
  userType: 'staff' | 'student';
  isRegistered: boolean;
  registeredUserId: mongoose.Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const verifiedUserSchema = new Schema<IVerifiedUser>(
  {
    universityId: {
      type: String,
      required: [true, 'University ID is required'],
      unique: true,
      index: true,
      validate: {
        validator: (v: string) => /^\d{5}$/.test(v),
        message: 'University ID must be exactly 5 digits',
      },
    },

    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
    },

    email: {
      type: String,
      required: [true, 'Email is required'],
      trim: true,
      lowercase: true,
    },

    phone: {
      type: String,
      default: '-',
      trim: true,
      validate: {
        validator: (v: string) => !v || v === '-' || /^\d{10}$/.test(v),
        message: 'Phone number must be exactly 10 digits or -',
      },
    },

    department: {
      type: String,
      default: null,
      trim: true,
    },

    userType: {
      type: String,
      enum: ['staff', 'student'],
      default: 'staff',
      index: true,
    },

    isRegistered: {
      type: Boolean,
      default: false,
    },

    registeredUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

const VerifiedUser = mongoose.model<IVerifiedUser>('VerifiedUser', verifiedUserSchema, 'verified_users');

export default VerifiedUser;
