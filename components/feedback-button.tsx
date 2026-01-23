'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { HugeiconsIcon } from '@hugeicons/react';
import { Notification02Icon } from '@hugeicons/core-free-icons';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { FeedbackForm } from '@/components/feedback-form';

export function FeedbackButton() {
  const t = useTranslations('feedback');
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="fixed bottom-20 right-4 md:bottom-4 z-40 h-12 w-12 rounded-full shadow-lg"
          aria-label={t('button')}
        >
          <HugeiconsIcon icon={Notification02Icon} className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{t('title')}</SheetTitle>
          <SheetDescription>
            {t('messagePlaceholder')}
          </SheetDescription>
        </SheetHeader>
        <div className="mt-6">
          <FeedbackForm onSuccess={() => setOpen(false)} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
