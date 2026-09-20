'use client';

import { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ImportConfig } from '@/lib/import-engine/types';
import { buildImportTemplate, triggerBlobDownload } from '@/lib/import-engine/templateBuilder';

export function TemplateDownloadButton({ config, size = 'sm' }: { config: ImportConfig; size?: 'sm' | 'default' }) {
  const [loading, setLoading] = useState(false);
  const handleClick = async () => {
    setLoading(true);
    try {
      const blob = await buildImportTemplate(config, { moduleLabel: config.moduleLabel });
      triggerBlobDownload(blob, config.templateFileName);
    } finally {
      setLoading(false);
    }
  };
  return (
    <Button variant="outline" size={size} onClick={handleClick} disabled={loading} className="gap-1.5">
      {loading ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />} Template
    </Button>
  );
}
