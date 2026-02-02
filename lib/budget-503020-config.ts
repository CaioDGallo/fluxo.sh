import { Home01Icon, GameController01Icon, PiggyBankIcon } from '@hugeicons/core-free-icons';
import type { BucketType } from '@/lib/actions/budget-503020';

/**
 * Bucket configuration for 50/30/20 budget methodology
 * Used across multiple components for consistent styling and labeling
 */
export const BUCKET_CONFIG = {
  necessities: {
    label: 'Necessidades',
    icon: Home01Icon,
    // Tailwind classes
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    progressColor: 'bg-blue-500',
    badgeClassName: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
    // Hex colors (for recharts)
    hexColor: '#3b82f6',
  },
  wants: {
    label: 'Desejos',
    icon: GameController01Icon,
    // Tailwind classes
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
    progressColor: 'bg-purple-500',
    badgeClassName: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
    // Hex colors (for recharts)
    hexColor: '#a855f7',
  },
  savings: {
    label: 'Poupança',
    icon: PiggyBankIcon,
    // Tailwind classes
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    progressColor: 'bg-green-500',
    badgeClassName: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
    // Hex colors (for recharts)
    hexColor: '#22c55e',
  },
} as const satisfies Record<BucketType, {
  label: string;
  icon: typeof Home01Icon;
  color: string;
  bgColor: string;
  progressColor: string;
  badgeClassName: string;
  hexColor: string;
}>;

/**
 * Pacing configuration for spending pace indicators
 * Used to show whether user is on track, over pace, or under pace
 */
export const PACING_CONFIG = {
  on_track: {
    label: 'No ritmo',
    labelCapitalized: 'No Ritmo',
    description: 'Seu ritmo está equilibrado',
    // Tailwind classes
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    barColor: 'bg-green-500',
    // Hex colors (for recharts)
    hexColor: '#22c55e',
  },
  over_pace: {
    label: 'Gastando rápido',
    labelCapitalized: 'Gastando Rápido',
    description: 'Você está acima do ritmo esperado',
    // Tailwind classes
    color: 'text-orange-600',
    bgColor: 'bg-orange-50',
    barColor: 'bg-orange-500',
    // Hex colors (for recharts)
    hexColor: '#f97316',
  },
  under_pace: {
    label: 'Economizando',
    labelCapitalized: 'Economizando',
    description: 'Você está abaixo do ritmo esperado',
    // Tailwind classes
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    barColor: 'bg-blue-500',
    // Hex colors (for recharts)
    hexColor: '#3b82f6',
  },
} as const;
