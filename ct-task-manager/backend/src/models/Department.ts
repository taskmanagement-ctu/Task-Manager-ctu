import mongoose, { Document, Schema } from 'mongoose';
import { normalizeDepartmentName, formatDepartmentDisplayName } from '../utils/normalization';

export interface IDepartment extends Document {
  name: string;
  normalizedName: string;
  code?: string;
  verifiedUserAccess: 'none' | 'staff' | 'student' | 'both';
  canAddVerifiedUsers: boolean;
  canUploadVerifiedUsers: boolean;
}

const DepartmentSchema: Schema = new Schema({
  name: { type: String, required: true, unique: true, trim: true },
  normalizedName: { type: String, trim: true, index: true },
  code: { type: String, trim: true, uppercase: true, default: '' },
  verifiedUserAccess: {
    type: String,
    enum: ['none', 'staff', 'student', 'both'],
    default: 'none',
  },
  canAddVerifiedUsers: {
    type: Boolean,
    default: true,
  },
  canUploadVerifiedUsers: {
    type: Boolean,
    default: true,
  },
}, { timestamps: true });

// Pre-save hook: auto-compute normalizedName and format name display
DepartmentSchema.pre('save', function (next) {
  if (this.isModified('name') || !this.get('normalizedName')) {
    const rawName = String(this.get('name') || '');
    this.set('name', formatDepartmentDisplayName(rawName));
    this.set('normalizedName', normalizeDepartmentName(rawName));
  }
  next();
});

export default mongoose.model<IDepartment>('Department', DepartmentSchema);
