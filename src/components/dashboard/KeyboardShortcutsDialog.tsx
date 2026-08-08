'use client';

import {
  Keyboard,
  Plus,
  Download,
  Search,
  X,
  HelpCircle,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';

interface KeyboardShortcutsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ShortcutItem {
  keys: string[];
  description: string;
  icon: React.ReactNode;
}

const SHORTCUTS: ShortcutItem[] = [
  {
    keys: ['Ctrl', 'N'],
    description: 'Tambah data baru',
    icon: <Plus className="size-4" />,
  },
  {
    keys: ['Ctrl', 'E'],
    description: 'Export indikator saat ini',
    icon: <Download className="size-4" />,
  },
  {
    keys: ['Ctrl', 'F'],
    description: 'Fokus ke pencarian',
    icon: <Search className="size-4" />,
  },
  {
    keys: ['Esc'],
    description: 'Bersihkan pencarian / Tutup modal',
    icon: <X className="size-4" />,
  },
  {
    keys: ['?'],
    description: 'Tampilkan bantuan shortcut',
    icon: <HelpCircle className="size-4" />,
  },
];

export function KeyboardShortcutsDialog({
  open,
  onOpenChange,
}: KeyboardShortcutsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-border bg-card sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <Keyboard className="size-5 text-primary" />
            Pintasan Keyboard
          </DialogTitle>
        </DialogHeader>
        <div className="mt-2 space-y-1">
          {SHORTCUTS.map((shortcut) => (
            <div
              key={shortcut.description}
              className="flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 hover:bg-accent/50 transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <span className="text-muted-foreground">{shortcut.icon}</span>
                <span className="text-sm text-foreground/80">
                  {shortcut.description}
                </span>
              </div>
              <div className="flex items-center gap-1">
                {shortcut.keys.map((key, idx) => (
                  <span key={idx} className="flex items-center gap-1">
                    <Badge
                      variant="secondary"
                      className="font-mono text-[10px] px-2 py-0.5 min-w-[28px] justify-center bg-accent text-accent-foreground"
                    >
                      {key}
                    </Badge>
                    {idx < shortcut.keys.length - 1 && (
                      <span className="text-[10px] text-muted-foreground">+</span>
                    )}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 pt-3 border-t border-border">
          <p className="text-xs text-muted-foreground text-center">
            Gunakan <Badge variant="secondary" className="font-mono text-[9px] px-1.5 py-0 bg-accent text-accent-foreground">Ctrl</Badge> di Windows/Linux atau{' '}
            <Badge variant="secondary" className="font-mono text-[9px] px-1.5 py-0 bg-accent text-accent-foreground">⌘ Cmd</Badge> di Mac
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
