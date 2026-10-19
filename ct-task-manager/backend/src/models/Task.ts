import mongoose, { Schema, Document } from 'mongoose';
import Counter from './Counter';

export interface ITask extends Document {
  taskId: string;
  title: string;
  description: string;
  createdBy: mongoose.Types.ObjectId;
  assignedTo: mongoose.Types.ObjectId | null;
  delegatedTo: mongoose.Types.ObjectId | null;
  coAssignees?: mongoose.Types.ObjectId[];
  assignmentMode?: 'individual' | 'shared';
  deadline: Date;
  status: 'pending' | 'in_progress' | 'completed' | 'submitted_for_review' | 'approved' | 'rejected';
  parentTaskId: mongoose.Types.ObjectId | null;
  isSubtask: boolean;
  workflowType?: 'super_admin_direct' | 'department_admin';
  reviewStage: 'none' | 'department_admin' | 'super_admin';
  currentReviewer: mongoose.Types.ObjectId | null;
  reviewRequestedBy: mongoose.Types.ObjectId | null;
  rejectionReason: string | null;
  attachments: mongoose.Types.ObjectId[];
  completionAttachments: mongoose.Types.ObjectId[];
  requiredCompletionExtensions: string[];
  submittedAt?: Date | null;
  completedAt: Date | null;
  rating?: number | null;
  feedback?: string | null;
  ratedBy?: mongoose.Types.ObjectId | null;
  ratedAt?: Date | null;
  ratedUser?: mongoose.Types.ObjectId | null;
  comments?: Array<{
    _id?: mongoose.Types.ObjectId;
    sender: mongoose.Types.ObjectId;
    message: string;
    channel?: 'super_admin' | 'staff' | 'general';
    attachments?: mongoose.Types.ObjectId[];
    readBy?: mongoose.Types.ObjectId[];
    readAt?: Date | null;
    createdAt: Date;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

const taskSchema = new Schema<ITask>(
  {
    taskId: {
      type: String,
      unique: true
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    assignedTo: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    delegatedTo: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    coAssignees: [{
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: [],
      index: true,
    }],
    assignmentMode: {
      type: String,
      enum: ['individual', 'shared'],
      default: 'individual',
      index: true,
    },
    deadline: {
      type: Date,
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['pending', 'in_progress', 'completed', 'submitted_for_review', 'approved', 'rejected'],
      default: 'pending',
      index: true,
    },
    parentTaskId: {
      type: Schema.Types.ObjectId,
      ref: 'Task',
      default: null,
    },
    isSubtask: {
      type: Boolean,
      default: false,
    },
    workflowType: {
      type: String,
      enum: ['super_admin_direct', 'department_admin'],
    },
    reviewStage: {
      type: String,
      enum: ['none', 'department_admin', 'super_admin'],
      default: 'none',
      index: true,
    },
    currentReviewer: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    reviewRequestedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    rejectionReason: {
      type: String,
      default: null,
    },
    attachments: [{
      type: Schema.Types.ObjectId,
      default: []
    }],
    completionAttachments: [{
      type: Schema.Types.ObjectId,
      default: []
    }],
    requiredCompletionExtensions: [{
      type: String,
      default: []
    }],
    submittedAt: {
      type: Date,
      default: null
    },
    completedAt: {
      type: Date,
      default: null
    },
    rating: {
      type: Number,
      min: 1,
      max: 5,
      default: null
    },
    feedback: {
      type: String,
      default: null
    },
    ratedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    ratedAt: {
      type: Date,
      default: null
    },
    ratedUser: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true
    },
    comments: [
      {
        sender: {
          type: Schema.Types.ObjectId,
          ref: 'User',
          required: true
        },
        message: {
          type: String,
          required: true,
          trim: true,
          maxlength: 3000
        },
        channel: {
          type: String,
          enum: ['super_admin', 'staff', 'general'],
          default: 'general'
        },
        attachments: [{
          type: Schema.Types.ObjectId,
          default: []
        }],
        readBy: [{
          type: Schema.Types.ObjectId,
          ref: 'User',
          default: []
        }],
        readAt: {
          type: Date,
          default: null
        },
        createdAt: {
          type: Date,
          default: Date.now
        }
      }
    ]
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

taskSchema.pre<ITask>('save', async function(next) {
  if (this.isNew && !this.taskId) {
    try {
      const counter = await Counter.findByIdAndUpdate(
        { _id: 'taskId' },
        { $inc: { sequence_value: 1 } },
        { new: true, upsert: true }
      );
      this.taskId = String(counter.sequence_value).padStart(5, '0');
      next();
    } catch (error: any) {
      next(error);
    }
  } else {
    next();
  }
});

const Task = mongoose.model<ITask>('Task', taskSchema, 'tasks');

export default Task;
