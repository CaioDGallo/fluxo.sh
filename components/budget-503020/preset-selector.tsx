'use client';

import { useState } from 'react';
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
import { Settings02Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface PresetSelectorProps {
  currentPreset: PresetType;
}

const PRESETS = [
  {
    value: 'na_risca' as const,
    label: 'Na Risca',
    description: '50% Necessidades, 30% Desejos, 20% Poupança',
    detail: 'Ideal para quem já tem controle financeiro estabelecido',
  },
  {
    value: 'entrando_na_linha' as const,
    label: 'Entrando na Linha',
    description: '60% Necessidades, 30% Desejos, 10% Poupança',
    detail: 'Recomendado para quem está começando a organizar as finanças',
  },
] as const;

export function PresetSelector({ currentPreset }: PresetSelectorProps) {
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

      toast.success('Configuração atualizada com sucesso');
      setOpen(false);
      window.location.reload(); // Reload to fetch new data
    } catch (error) {
      console.error('[PresetSelector] Error:', error);
      toast.error('Erro ao atualizar configuração');
    } finally {
      setIsSubmitting(false);
    }
  }

  const currentPresetLabel = PRESETS.find((p) => p.value === currentPreset)?.label ?? 'Na Risca';

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
          <AlertDialogTitle>Configurar Método 50/30/20</AlertDialogTitle>
          <AlertDialogDescription>
            Escolha o modelo de distribuição que melhor se adapta ao seu momento financeiro
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-3">
          {PRESETS.map((preset) => (
            <button
              key={preset.value}
              type="button"
              onClick={() => setSelected(preset.value)}
              className={cn(
                'w-full text-left p-4 rounded-lg border-2 transition-all',
                selected === preset.value
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              )}
            >
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold">{preset.label}</h4>
                  {selected === preset.value && (
                    <span className="text-blue-600">✓</span>
                  )}
                </div>
                <p className="text-sm font-medium text-gray-700">
                  {preset.description}
                </p>
                <p className="text-xs text-gray-500">
                  {preset.detail}
                </p>
              </div>
            </button>
          ))}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isSubmitting}>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={handleSave} disabled={isSubmitting}>
            {isSubmitting ? 'Salvando...' : 'Salvar'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
