import React, { useEffect } from 'react';
import { CheckCircle, XCircle, AlertCircle, X } from 'lucide-react';

export type ModalType = 'success' | 'error' | 'warning' | 'info';

interface SuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  type?: ModalType;
  title?: string;
  message: string;
  autoClose?: boolean;
  autoCloseDelay?: number;
  /** Optional second action (e.g. navigate to Saved Emails after save). */
  secondaryAction?: { label: string; onClick: () => void };
}

export const SuccessModal: React.FC<SuccessModalProps> = ({
  isOpen,
  onClose,
  type = 'success',
  title,
  message,
  autoClose = true,
  autoCloseDelay = 3000,
  secondaryAction,
}) => {
  useEffect(() => {
    if (isOpen && autoClose && !secondaryAction) {
      const timer = setTimeout(() => {
        onClose();
      }, autoCloseDelay);
      return () => clearTimeout(timer);
    }
  }, [isOpen, autoClose, autoCloseDelay, onClose, secondaryAction]);

  if (!isOpen) return null;

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircle className="w-12 h-12 text-green-500" />;
      case 'error':
        return <XCircle className="w-12 h-12 text-red-500" />;
      case 'warning':
        return <AlertCircle className="w-12 h-12 text-yellow-500" />;
      case 'info':
        return <AlertCircle className="w-12 h-12 text-blue-500" />;
      default:
        return <CheckCircle className="w-12 h-12 text-green-500" />;
    }
  };

  const getBgColor = () => {
    switch (type) {
      case 'success':
        return 'bg-green-50';
      case 'error':
        return 'bg-red-50';
      case 'warning':
        return 'bg-yellow-50';
      case 'info':
        return 'bg-blue-50';
      default:
        return 'bg-green-50';
    }
  };

  const getBorderColor = () => {
    switch (type) {
      case 'success':
        return 'border-green-200';
      case 'error':
        return 'border-red-200';
      case 'warning':
        return 'border-yellow-200';
      case 'info':
        return 'border-blue-200';
      default:
        return 'border-green-200';
    }
  };

  const getTitleColor = () => {
    switch (type) {
      case 'success':
        return 'text-green-900';
      case 'error':
        return 'text-red-900';
      case 'warning':
        return 'text-yellow-900';
      case 'info':
        return 'text-blue-900';
      default:
        return 'text-green-900';
    }
  };

  const getMessageColor = () => {
    switch (type) {
      case 'success':
        return 'text-green-700';
      case 'error':
        return 'text-red-700';
      case 'warning':
        return 'text-yellow-700';
      case 'info':
        return 'text-blue-700';
      default:
        return 'text-green-700';
    }
  };

  const defaultTitle = type === 'success' 
    ? 'Success!' 
    : type === 'error' 
    ? 'Error' 
    : type === 'warning'
    ? 'Warning'
    : 'Information';

  return (
    <div className="fixed inset-0 z-[1000000] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black bg-opacity-50 transition-opacity z-[1000000]"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className={`relative bg-white rounded-lg shadow-xl max-w-md w-full ${getBgColor()} border-2 ${getBorderColor()} transform transition-all z-[1000001]`}>
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Content */}
        <div className="p-6">
          <div className="flex items-start gap-4">
            {/* Icon */}
            <div className="flex-shrink-0">
              {getIcon()}
            </div>

            {/* Text content */}
            <div className="flex-1 min-w-0">
              <h3 className={`text-lg font-semibold ${getTitleColor()} mb-2`}>
                {title || defaultTitle}
              </h3>
              <p className={`text-sm ${getMessageColor()}`}>
                {message}
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="mt-6 flex flex-wrap justify-end gap-2">
            {secondaryAction && (
              <button
                type="button"
                onClick={() => {
                  secondaryAction.onClick();
                }}
                className="px-4 py-2 rounded-md text-sm font-medium border border-gray-300 bg-white text-gray-800 hover:bg-gray-50 transition-colors"
              >
                {secondaryAction.label}
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                type === 'success'
                  ? 'bg-green-600 text-white hover:bg-green-700'
                  : type === 'error'
                  ? 'bg-red-600 text-white hover:bg-red-700'
                  : type === 'warning'
                  ? 'bg-yellow-600 text-white hover:bg-yellow-700'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              OK
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

