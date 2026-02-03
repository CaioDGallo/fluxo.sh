'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { disconnectPluggyItem } from '@/lib/actions/pluggy';
import { toast } from 'sonner';

type PluggyDisconnectDialogProps = {
  itemId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
};

export function PluggyDisconnectDialog({
  itemId,
  open,
  onOpenChange,
  onSuccess,
}: PluggyDisconnectDialogProps) {
  const [keepData, setKeepData] = useState(true);
  const [isPending, startTransition] = useTransition();
  const t = useTranslations('openFinance');
  const tCommon = useTranslations('common');

  const handleDisconnect = () => {
    startTransition(async () => {
      try {
        const result = await disconnectPluggyItem(itemId, keepData);
        if (result.success) {
          toast.success(t('disconnectSuccess'));
          onSuccess();
          onOpenChange(false);
        } else {
          toast.error(result.error);
        }
      } catch {
        toast.error(tCommon('unexpectedError'));
      }
    });
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('disconnectTitle')}</AlertDialogTitle>
          <AlertDialogDescription>{t('disconnectDescription')}</AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-3 py-2">
          <button
            type="button"
            onClick={() => setKeepData(true)}
            className={`w-full text-left p-3 rounded-md border transition-colors ${
              keepData ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted'
            }`}
          >
            <p className="font-medium text-sm">{t('keepData')}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{t('keepDataDescription')}</p>
          </button>

          <button
            type="button"
            onClick={() => setKeepData(false)}
            className={`w-full text-left p-3 rounded-md border transition-colors ${
              !keepData ? 'border-red-500 bg-red-50' : 'border-border hover:bg-muted'
            }`}
          >
            <p className="font-medium text-sm text-red-600">{t('deleteData')}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{t('deleteDataDescription')}</p>
          </button>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>{tCommon('cancel')}</AlertDialogCancel>
          <Button
            variant={keepData ? 'default' : 'destructive'}
            onClick={handleDisconnect}
            disabled={isPending}
          >
            {isPending ? t('disconnecting') : t('disconnect')}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
