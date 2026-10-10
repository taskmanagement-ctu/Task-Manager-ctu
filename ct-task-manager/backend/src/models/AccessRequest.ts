import mongoose, { Schema, Document } from 'mongoose';

export interface IAccessRequest extends Document {
  universityId: string;
  name: string;
  email: string;
  phone: string;
  department: string | null;
  userType: 'teaching' | 'non_teaching' | 'staff' | 'student';
  category: string | null;
  reason: string | null;
  status: 'pending' | 'approved' | 'rejected';
  rejectionReason: string | null;
  reviewedBy: mongoose.Types.ObjectId | null;
  reviewedByName: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const accessRequestSchema = new Schema<IAccessRequest>(
  {
    universityId: {
      type: String,
      required: [true, 'University ID is required'],
      trim: true,
      index: true,
      validate: {
        validator: (v: string) => /^\d{3,5}$/.test(v),
        message: 'University ID must be between 3 and 5 digits',
      },
    },
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Institutional email is required'],
      trim: true,
      lowercase: true,
      index: true,
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      trim: true,
      validate: {
        validator: (v: string) => !v || /^\d{10}$/.test(v),
        message: 'Phone number must be exactly 10 digits',
      },
    },
    department: {
      type: String,
      default: null,
      trim: true,
      index: true,
    },
    userType: {
      type: String,
      enum: ['teaching', 'non_teaching', 'staff', 'student'],
      default: 'teaching',
      index: true,
    },
    category: {
      type: String,
      default: 'Teaching Staff',
      trim: true,
    },
    reason: {
      type: String,
      default: null,
      trim: true,
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
      index: true,
    },
    rejectionReason: {
      type: String,
      default: null,
      trim: true,
    },
    reviewedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    reviewedByName: {
      type: String,
      default: null,
      trim: true,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Helpful compound index for queries
accessRequestSchema.index({ status: 1, department: 1, createdAt: -1 });

const AccessRequest = mongoose.model<IAccessRequest>('AccessRequest', accessRequestSchema, 'access_requests');

export default AccessRequest;
