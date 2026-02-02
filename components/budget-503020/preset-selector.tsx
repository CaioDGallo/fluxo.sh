'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
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
import { updateBudgetConfig, type PresetType } from '@/lib/actions/budget-503020';
import { Settings02Icon, Tick02Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useTranslations } from 'next-intl';

interface PresetSelectorProps {
  currentPreset: PresetType;
}

const PRESETS = ['na_risca', 'entrando_na_linha'] as const;

// Map snake_case preset values to camelCase translation keys
const PRESET_KEY_MAP: Record<PresetType, string> = {
  na_risca: 'naRisca',
  entrando_na_linha: 'entrandoNaLinha',
  custom: 'custom',
};

export function PresetSelector({ currentPreset }: PresetSelectorProps) {
  const t = useTranslations('budget503020.presets');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<PresetType>(currentPreset);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSave() {
    if (selected === currentPreset) {
      setOpen(false);
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await updateBudgetConfig(selected);

      if (!result.success) {
        toast.error(result.error);
        return;
      }

      toast.success(t('updateSuccess'));
      setOpen(false);
      router.refresh(); // Refresh to fetch new data
    } catch (error) {
      console.error('[PresetSelector] Update failed:', {
        currentPreset,
        selectedPreset: selected,
        error,
      });
      toast.error(t('updateError'));
    } finally {
      setIsSubmitting(false);
    }
  }

  const currentPresetLabel = t(PRESET_KEY_MAP[currentPreset]);

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <HugeiconsIcon icon={Settings02Icon} size={16} />
          <span className="hidden sm:inline">{currentPresetLabel}</span>
        </Button>
      </AlertDialogTrigger>

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('configure')}</AlertDialogTitle>
          <AlertDialogDescription>
            {t('chooseModel')}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-3">
          {PRESETS.map((preset) => {
            const key = PRESET_KEY_MAP[preset];
            return (
              <button
                key={preset}
                type="button"
                onClick={() => setSelected(preset)}
                className={cn(
                  'w-full text-left p-4 rounded-none border-2 transition-all',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                  selected === preset
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-border/80'
                )}
              >
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold">{t(key)}</h4>
                    {selected === preset && (
                      <HugeiconsIcon
                        icon={Tick02Icon}
                        className="text-primary"
                        size={20}
                        aria-label="Selecionado"
                      />
                    )}
                  </div>
                  <p className="text-sm font-medium text-foreground">
                    {t(`${key}Description`)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t(`${key}Detail`)}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isSubmitting}>{tCommon('cancel')}</AlertDialogCancel>
          <AlertDialogAction onClick={handleSave} disabled={isSubmitting}>
            {isSubmitting ? tCommon('saving') : tCommon('save')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
