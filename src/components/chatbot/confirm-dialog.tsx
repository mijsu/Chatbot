'use client';

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
  AlertDialogOverlay,
} from '@/components/ui/alert-dialog';
import { AlertTriangle, Trash2, LogOut, X } from 'lucide-react';

/* ─── Types ─── */

export type ConfirmVariant = 'danger' | 'warning';

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ConfirmVariant;
  icon?: 'delete' | 'logout' | 'warning';
  onConfirm: () => void;
}

/* ─── Icon map — monoline, no fill ─── */

const iconMap = {
  delete: <Trash2 className="w-5 h-5" strokeWidth={1.5} style={{ color: 'var(--nd-accent)' }} />,
  logout: <LogOut className="w-5 h-5" strokeWidth={1.5} style={{ color: 'var(--nd-accent)' }} />,
  warning: <AlertTriangle className="w-5 h-5" strokeWidth={1.5} style={{ color: 'var(--nd-warning)' }} />,
};

/* ─── Component ─── */

export default function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  icon = 'warning',
  onConfirm,
}: ConfirmDialogProps) {
  const isDanger = variant === 'danger';

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogOverlay
        className="border-0 shadow-none"
        style={{
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          backdropFilter: 'none',
        }}
      />
      <AlertDialogContent
        className="border-0 shadow-none outline-none p-0 overflow-hidden"
        style={{
          backgroundColor: 'var(--nd-surface)',
          border: '1px solid var(--nd-border-visible)',
          borderRadius: '16px',
          maxWidth: '340px',
          width: 'calc(100% - 2rem)',
        }}
      >
        {/* Close button — [ X ] top-right ghost */}
        <button
          onClick={() => onOpenChange(false)}
          className="absolute top-4 right-4 z-10 flex items-center justify-center w-8 h-8"
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--nd-text-secondary)',
            cursor: 'pointer',
          }}
          aria-label="Close"
        >
          <X className="w-4 h-4" strokeWidth={1.5} />
        </button>

        <div className="flex flex-col items-center text-center px-4 pt-5 pb-1 sm:px-6 sm:pt-7">
          <AlertDialogHeader className="flex flex-col items-center gap-0 p-0">
            {/* Icon area — circle with border, monoline icon */}
            <div
              className="flex items-center justify-center mb-4"
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '999px',
                border: isDanger
                  ? '1px solid var(--nd-accent)'
                  : '1px solid var(--nd-warning)',
                background: 'transparent',
              }}
            >
              {iconMap[icon]}
            </div>

            <AlertDialogTitle
              className="text-base font-medium mb-1.5 p-0"
              style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontSize: '16px',
                color: 'var(--nd-text-display)',
                lineHeight: 1.3,
              }}
            >
              {title}
            </AlertDialogTitle>

            <AlertDialogDescription
              className="text-xs p-0"
              style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontSize: '13px',
                color: 'var(--nd-text-secondary)',
                lineHeight: 1.5,
              }}
            >
              {description}
            </AlertDialogDescription>
          </AlertDialogHeader>
        </div>

        <AlertDialogFooter
          className="flex-row gap-2 px-4 pb-5 pt-3 sm:px-6 sm:pb-6 sm:gap-3 sm:flex-row"
        >
          <AlertDialogCancel
            className="nd-btn-secondary flex-1"
            style={{
              background: 'transparent',
              border: '1px solid var(--nd-border-visible)',
              color: 'var(--nd-text-primary)',
              borderRadius: '999px',
              padding: '10px 16px',
              minHeight: '38px',
              fontFamily: "'Space Mono', monospace",
              fontSize: '11px',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              cursor: 'pointer',
            }}
          >
            {cancelLabel}
          </AlertDialogCancel>

          <AlertDialogAction
            className={isDanger ? 'nd-btn-destructive flex-1' : 'nd-btn-primary flex-1'}
            style={
              isDanger
                ? {
                    background: 'transparent',
                    border: '1px solid var(--nd-accent)',
                    color: 'var(--nd-accent)',
                    borderRadius: '999px',
                    padding: '10px 16px',
                    minHeight: '38px',
                    fontFamily: "'Space Mono', monospace",
                    fontSize: '11px',
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                    boxShadow: 'none',
                  }
                : {
                    background: 'var(--nd-text-display)',
                    border: 'none',
                    color: 'var(--nd-black)',
                    borderRadius: '999px',
                    padding: '10px 16px',
                    minHeight: '38px',
                    fontFamily: "'Space Mono', monospace",
                    fontSize: '11px',
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                    boxShadow: 'none',
                  }
            }
            onClick={onConfirm}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
