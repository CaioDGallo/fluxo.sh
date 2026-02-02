'use client';

import { cn } from '@/lib/utils';
import { Home01Icon, GameController01Icon, PiggyBankIcon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import type { BucketType } from '@/lib/actions/budget-503020';

interface CategoryBucketPickerProps {
  value: BucketType | null;
  onChange: (bucket: BucketType | null) => void;
  disabled?: boolean;
}

const BUCKETS = [
  {
    value: 'necessities' as const,
    label: 'Necessidades',
    description: '50% - Alimentação, moradia, transporte',
    icon: Home01Icon,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    ringColor: 'ring-blue-500',
  },
  {
    value: 'wants' as const,
    label: 'Desejos',
    description: '30% - Entretenimento, compras, lazer',
    icon: GameController01Icon,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
    ringColor: 'ring-purple-500',
  },
  {
    value: 'savings' as const,
    label: 'Poupança',
    description: '20% - Investimentos, reservas',
    icon: PiggyBankIcon,
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    ringColor: 'ring-green-500',
  },
] as const;

export function CategoryBucketPicker({ value, onChange, disabled }: CategoryBucketPickerProps) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {BUCKETS.map((bucket) => {
          const Icon = bucket.icon;
          const isSelected = value === bucket.value;

          return (
            <button
              key={bucket.value}
              type="button"
              onClick={() => onChange(bucket.value)}
              disabled={disabled}
              className={cn(
                'flex flex-col items-start gap-2 rounded-lg border-2 p-3 text-left transition-all',
                'hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-50',
                isSelected
                  ? `${bucket.borderColor} ${bucket.bgColor} ring-2 ${bucket.ringColor} ring-offset-2`
                  : 'border-gray-200 bg-white hover:border-gray-300'
              )}
            >
              <div
                className={cn(
                  'flex items-center gap-2',
                  isSelected ? bucket.color : 'text-gray-600'
                )}
              >
                <HugeiconsIcon icon={Icon} size={20} />
                <span className="font-medium">{bucket.label}</span>
              </div>
              <p className="text-xs text-gray-500">{bucket.description}</p>
            </button>
          );
        })}
      </div>

      {value && (
        <button
          type="button"
          onClick={() => onChange(null)}
          disabled={disabled}
          className="text-sm text-gray-500 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Remover categorização
        </button>
      )}
    </div>
  );
}
