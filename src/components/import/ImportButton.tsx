'use client';

import { useState } from 'react';
import { Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ImportConfig } from '@/lib/import-engine/types';
import { ImportModal } from './ImportModal';

export function ImportButton({
  config, userId, onImported, size = 'sm',
}: { config: ImportConfig; userId: string; onImported?: () => void; size?: 'sm' | 'default' }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" size={size} onClick={() => setOpen(true)} className="gap-1.5">
        <Upload className="size-4" /> Import Data
      </Button>
      {open && (
        <ImportModal open={open} onClose={() => setOpen(false)} config={config} userId={userId} onImported={onImported} />
      )}
    </>
  );
}
