'use client';

import { toast } from 'sonner';
import { CheckCircle2, XCircle, AlertTriangle, Info, Undo2, ExternalLink } from 'lucide-react';

/* ── Enhanced toast helpers with undo, icons, and view details ── */

interface ToastOptions {
  description?: string;
  undo?: () => void;
  undoLabel?: string;
  viewDetails?: () => void;
  viewDetailsLabel?: string;
  duration?: number;
}

/**
 * Success toast with green check icon
 */
export function toastSuccess(title: string, options?: ToastOptions) {
  const actions: React.ReactNode[] = [];

  if (options?.undo) {
    actions.push(
      <button
        key="undo"
        onClick={options.undo}
        className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-foreground/80 hover:bg-muted transition-colors"
      >
        <Undo2 className="size-3" />
        {options.undoLabel || 'Undo'}
      </button>
    );
  }

  if (options?.viewDetails) {
    actions.push(
      <button
        key="details"
        onClick={options.viewDetails}
        className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-[#4f8ef7] hover:bg-[#4f8ef7]/10 transition-colors"
      >
        <ExternalLink className="size-3" />
        {options.viewDetailsLabel || 'Lihat Detail'}
      </button>
    );
  }

  toast.success(title, {
    description: options?.description,
    duration: options?.duration || 4000,
    icon: <CheckCircle2 className="size-4 text-emerald-400" />,
    action: actions.length > 0 ? (
      <div className="flex items-center gap-1">
        {actions}
      </div>
    ) : undefined,
  });
}

/**
 * Error toast with red X icon
 */
export function toastError(title: string, options?: ToastOptions) {
  const actions: React.ReactNode[] = [];

  if (options?.undo) {
    actions.push(
      <button
        key="undo"
        onClick={options.undo}
        className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-foreground/80 hover:bg-muted transition-colors"
      >
        <Undo2 className="size-3" />
        {options.undoLabel || 'Undo'}
      </button>
    );
  }

  if (options?.viewDetails) {
    actions.push(
      <button
        key="details"
        onClick={options.viewDetails}
        className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-[#4f8ef7] hover:bg-[#4f8ef7]/10 transition-colors"
      >
        <ExternalLink className="size-3" />
        {options.viewDetailsLabel || 'Lihat Detail'}
      </button>
    );
  }

  toast.error(title, {
    description: options?.description,
    duration: options?.duration || 5000,
    icon: <XCircle className="size-4 text-red-400" />,
    action: actions.length > 0 ? (
      <div className="flex items-center gap-1">
        {actions}
      </div>
    ) : undefined,
  });
}

/**
 * Warning toast with amber alert icon
 */
export function toastWarning(title: string, options?: ToastOptions) {
  toast.warning(title, {
    description: options?.description,
    duration: options?.duration || 4000,
    icon: <AlertTriangle className="size-4 text-amber-400" />,
  });
}

/**
 * Info toast with blue info icon
 */
export function toastInfo(title: string, options?: ToastOptions) {
  toast.info(title, {
    description: options?.description,
    duration: options?.duration || 3000,
    icon: <Info className="size-4 text-sky-400" />,
  });
}

/**
 * Data change toast with undo support
 * Shows a success toast with an undo button for data modifications
 */
export function toastDataChange(
  action: 'add' | 'update' | 'delete' | 'import',
  count: number,
  undo?: () => void,
  viewDetails?: () => void
) {
  const labels: Record<string, { title: string; desc: string }> = {
    add: {
      title: 'Data berhasil ditambahkan',
      desc: `${count} baris data baru telah ditambahkan.`,
    },
    update: {
      title: 'Data berhasil diperbarui',
      desc: `${count} baris data telah diperbarui.`,
    },
    delete: {
      title: 'Data berhasil dihapus',
      desc: `${count} baris data telah dihapus.`,
    },
    import: {
      title: 'Import berhasil',
      desc: `${count} baris data telah diimpor dari file.`,
    },
  };

  const { title, desc } = labels[action] || labels.add;

  toastSuccess(title, {
    description: desc,
    undo,
    undoLabel: 'Batalkan',
    viewDetails,
    viewDetailsLabel: 'Lihat Audit',
    duration: action === 'delete' ? 6000 : 4000,
  });
}
