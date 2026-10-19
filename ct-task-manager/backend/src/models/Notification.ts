import mongoose, { Schema, Document } from 'mongoose';

export interface INotification extends Document {
  recipient: mongoose.Types.ObjectId;
  type: string;
  title: string;
  message: string;
  taskId?: mongoose.Types.ObjectId;
  triggeredBy?: mongoose.Types.ObjectId;
  isRead: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const notificationSchema = new Schema<INotification>(
  {
    recipient: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    type: {
      type: String,
      required: true,
      enum: [
        'task_assigned',
        'task_delegated',
        'task_status_changed',
        'task_submitted_for_review',
        'task_approved',
        'task_rejected',
        'task_rated',
        'new_chat_message',
        'deadline_extension_requested',
        'deadline_extension_endorsed',
        'deadline_extension_approved',
        'deadline_extension_rejected',
        'deadline_extended'
      ]
    },
    title: {
      type: String,
      required: true,
      trim: true
    },
    message: {
      type: String,
      required: true,
      trim: true
    },
    taskId: {
      type: Schema.Types.ObjectId,
      ref: 'Task',
      default: null
    },
    triggeredBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true
    }
  },
  {
    timestamps: true
  }
);

// Compound index for fast queries
notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, createdAt: -1 });

const Notification = mongoose.model<INotification>('Notification', notificationSchema);
export default Notification;
