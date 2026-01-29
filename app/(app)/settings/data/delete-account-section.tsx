'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { signOut } from 'next-auth/react';
import { toast } from 'sonner';
import { Delete02Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { deleteAccount } from '@/lib/actions/delete-account';

export function DeleteAccountSection() {
  const t = useTranslations('dataSettings');
  const tCommon = useTranslations('common');
  const tErrors = useTranslations('errors');
  const [isDeleting, setIsDeleting] = useState(false);
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  const required = t('deleteAccountConfirmValue');
  const isMatch = confirmText.trim().toUpperCase() === required;

  async function handleDelete() {
    setIsDeleting(true);
    try {
      const result = await deleteAccount();
      if (result.success) {
        toast.success(t('deleteAccountSuccess'));
        await signOut({ callbackUrl: '/' });
        return;
      }
      toast.error(result.error);
    } catch {
      toast.error(tErrors('unexpectedError'));
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="border-2 border-destructive/50 bg-destructive/5 p-6 mt-6">
      <div className="flex items-center gap-2 mb-2">
        <HugeiconsIcon icon={Delete02Icon} className="size-5 text-destructive" />
        <h2 className="text-lg font-semibold text-destructive">{t('deleteAccountTitle')}</h2>
      </div>
      <p className="text-sm text-muted-foreground mb-6">{t('deleteAccountDescription')}</p>

      <div className="border border-destructive/30 p-4 bg-background">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex-1">
            <h3 className="font-medium">{t('deleteAccount')}</h3>
            <p className="text-sm text-muted-foreground mt-1">{t('deleteAccountWarning')}</p>
          </div>
          <AlertDialog open={open} onOpenChange={(value) => {
            setOpen(value);
            if (!value) {
              setConfirmText('');
            }
          }}>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" className="shrink-0">
                {t('deleteAccountButton')}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t('deleteAccountConfirmTitle')}</AlertDialogTitle>
                <AlertDialogDescription>
                  {t('deleteAccountConfirmDescription')}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="space-y-2">
                <Label htmlFor="delete-account-confirm">{t('deleteAccountConfirmLabel')}</Label>
                <Input
                  id="delete-account-confirm"
                  value={confirmText}
                  onChange={(event) => setConfirmText(event.target.value.toUpperCase())}
                  placeholder={t('deleteAccountConfirmPlaceholder')}
                  disabled={isDeleting}
                />
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isDeleting}>{tCommon('cancel')}</AlertDialogCancel>
                <AlertDialogAction
                  onClick={(event) => {
                    event.preventDefault();
                    handleDelete();
                  }}
                  disabled={!isMatch || isDeleting}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {isDeleting ? t('deleteAccountDeleting') : t('deleteAccountConfirmButton')}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>
  );
}
