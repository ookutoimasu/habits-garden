import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { Button } from './Button';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children }) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-3 sm:p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="w-full max-w-md bg-white border border-[#E6E6E6] rounded-2xl p-4 sm:p-5 shadow-sm my-auto">
        <div className="flex items-center justify-between gap-3 pb-3 border-b border-[#EFEFEF]">
          <h2 id="modal-title" className="text-base sm:text-lg font-medium text-[#111111]">
            {title}
          </h2>
          <Button
            variant="icon"
            size="icon-md"
            onClick={onClose}
            aria-label="Закрыть окно"
            data-testid="modal-close-btn"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
        <div className="pt-3.5">{children}</div>
      </div>
    </div>
  );
};
