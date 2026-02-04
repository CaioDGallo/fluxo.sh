'use client';

import { useState } from 'react';
import { WizardStep } from '../wizard-step';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useOnboarding } from '../onboarding-provider';
import { useTranslations } from 'next-intl';
import { updateBudgetConfig, type PresetType } from '@/lib/actions/budget-503020';
import { toast } from 'sonner';
import { HugeiconsIcon } from '@hugeicons/react';
import { Tick02Icon } from '@hugeicons/core-free-icons';

const PRESETS: PresetType[] = ['na_risca', 'entrando_na_linha', 'saindo_das_dividas'];

const PRESET_KEY_MAP: Record<PresetType, string> = {
  na_risca: 'naRisca',
  entrando_na_linha: 'entrandoNaLinha',
  saindo_das_dividas: 'saindoDasDividas',
  custom: 'custom',
};

export function PresetStep() {
  const t = useTranslations('onboarding.preset');
  const tPresets = useTranslations('budget503020.presets');
  const tCommon = useTranslations('common');
  const { nextStep } = useOnboarding();
  const [selected, setSelected] = useState<PresetType>('na_risca');
  const [isSaving, setIsSaving] = useState(false);

  const handleContinue = async () => {
    setIsSaving(true);
    try {
      const result = await updateBudgetConfig(selected);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      nextStep();
    } catch (error) {
      console.error('[PresetStep] Failed to update preset:', error);
      toast.error(tCommon('unexpectedError'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <WizardStep className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-xl font-bold">{t('title')}</h2>
        <p className="text-sm text-muted-foreground">{t('description')}</p>
      </div>

      <div className="space-y-3">
        {PRESETS.map((preset) => {
          const key = PRESET_KEY_MAP[preset];
          const isSelected = selected === preset;

          return (
            <button
              key={preset}
              type="button"
              onClick={() => setSelected(preset)}
              aria-pressed={isSelected}
              disabled={isSaving}
              className={cn(
                'w-full text-left p-4 rounded-none border-2 transition-all',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                'disabled:cursor-not-allowed disabled:opacity-60',
                isSelected
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-border/80'
              )}
            >
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold">{tPresets(key)}</h4>
                  {isSelected && (
                    <HugeiconsIcon
                      icon={Tick02Icon}
                      className="text-primary"
                      size={20}
                      aria-hidden="true"
                    />
                  )}
                </div>
                <p className="text-sm font-medium text-foreground">
                  {tPresets(`${key}Description`)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {tPresets(`${key}Detail`)}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex gap-2">
        <Button variant="ghost" onClick={nextStep} className="flex-1" disabled={isSaving}>
          {t('skip')}
        </Button>
        <Button onClick={handleContinue} disabled={isSaving} className="flex-1">
          {isSaving ? tCommon('saving') : t('continue')}
        </Button>
      </div>
    </WizardStep>
  );
}
