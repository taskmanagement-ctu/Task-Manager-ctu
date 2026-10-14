import React from 'react';
import { Trash2, AlertTriangle, AlertCircle, X, Loader2 } from 'lucide-react';
import './ConfirmDeleteModal.css';

interface ConfirmDeleteModalProps {
  isOpen: boolean;
  taskId?: string;
  taskTitle: string;
  subtaskCount?: number;
  isDeleting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmDeleteModal: React.FC<ConfirmDeleteModalProps> = ({
  isOpen,
  taskId,
  taskTitle,
  subtaskCount = 0,
  isDeleting,
  onConfirm,
  onCancel
}) => {
  if (!isOpen) return null;

  return (
    <div 
      className="cdm-overlay" 
      onClick={(e) => {
        e.stopPropagation();
        if (!isDeleting) onCancel();
      }}
    >
      <div 
        className="cdm-box" 
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cdm-title"
      >
        <button 
          type="button" 
          className="cdm-close-btn" 
          onClick={(e) => {
            e.stopPropagation();
            onCancel();
          }}
          disabled={isDeleting}
          aria-label="Close"
          title="Cancel"
        >
          <X size={18} />
        </button>

        <div className="cdm-icon-wrapper">
          <Trash2 size={26} className="cdm-icon" />
        </div>

        <h3 id="cdm-title" className="cdm-title">
          Delete Task {taskId ? `#${taskId}` : ''}?
        </h3>

        <p className="cdm-description">
          Are you sure you want to permanently delete{' '}
          <strong className="cdm-highlight">"{taskTitle}"</strong>?
        </p>

        {subtaskCount > 0 && (
          <div className="cdm-warning-card">
            <AlertTriangle size={18} className="cdm-warning-icon" />
            <div className="cdm-warning-text">
              <strong>Warning:</strong> This task includes{' '}
              <strong>{subtaskCount} subtask{subtaskCount === 1 ? '' : 's'}</strong> in its deck.
              Deleting it will permanently delete all associated subtasks as well.
            </div>
          </div>
        )}

        <div className="cdm-notice">
          <AlertCircle size={14} />
          <span>This action is permanent and cannot be undone.</span>
        </div>

        <div className="cdm-actions">
          <button 
            type="button" 
            className="cdm-btn cdm-btn-cancel" 
            onClick={(e) => {
              e.stopPropagation();
              onCancel();
            }}
            disabled={isDeleting}
          >
            Cancel
          </button>
          <button 
            type="button" 
            className="cdm-btn cdm-btn-delete" 
            onClick={(e) => {
              e.stopPropagation();
              onConfirm();
            }}
            disabled={isDeleting}
            autoFocus
          >
            {isDeleting ? (
              <>
                <Loader2 size={15} className="cdm-spinner" />
                <span>Deleting...</span>
              </>
            ) : (
              <>
                <Trash2 size={15} />
                <span>Yes, Delete Task</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDeleteModal;
