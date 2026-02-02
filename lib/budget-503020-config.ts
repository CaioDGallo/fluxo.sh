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
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-500/10 dark:bg-blue-400/10',
    progressColor: 'bg-blue-500 dark:bg-blue-400',
    badgeClassName: 'bg-blue-600/20 text-blue-700 border border-blue-600/30 dark:bg-blue-400/20 dark:text-blue-300 dark:border-blue-400/30',
    // Hex colors (for recharts)
    hexColor: '#3b82f6',
    hexColorDark: '#60a5fa',
  },
  wants: {
    label: 'Desejos',
    icon: GameController01Icon,
    // Tailwind classes
    color: 'text-purple-600 dark:text-purple-400',
    bgColor: 'bg-purple-500/10 dark:bg-purple-400/10',
    progressColor: 'bg-purple-500 dark:bg-purple-400',
    badgeClassName: 'bg-purple-600/20 text-purple-700 border border-purple-600/30 dark:bg-purple-400/20 dark:text-purple-300 dark:border-purple-400/30',
    // Hex colors (for recharts)
    hexColor: '#a855f7',
    hexColorDark: '#c084fc',
  },
  savings: {
    label: 'Poupança',
    icon: PiggyBankIcon,
    // Tailwind classes
    color: 'text-green-600 dark:text-green-400',
    bgColor: 'bg-green-500/10 dark:bg-green-400/10',
    progressColor: 'bg-green-500 dark:bg-green-400',
    badgeClassName: 'bg-green-600/20 text-green-700 border border-green-600/30 dark:bg-green-400/20 dark:text-green-300 dark:border-green-400/30',
    // Hex colors (for recharts)
    hexColor: '#22c55e',
    hexColorDark: '#4ade80',
  },
} as const satisfies Record<BucketType, {
  label: string;
  icon: typeof Home01Icon;
  color: string;
  bgColor: string;
  progressColor: string;
  badgeClassName: string;
  hexColor: string;
  hexColorDark: string;
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
    color: 'text-green-600 dark:text-green-400',
    bgColor: 'bg-green-500/10 dark:bg-green-400/10',
    barColor: 'bg-green-500 dark:bg-green-400',
    // Hex colors (for recharts)
    hexColor: '#22c55e',
    hexColorDark: '#4ade80',
  },
  over_pace: {
    label: 'Gastando rápido',
    labelCapitalized: 'Gastando Rápido',
    description: 'Você está acima do ritmo esperado',
    // Tailwind classes
    color: 'text-orange-600 dark:text-orange-400',
    bgColor: 'bg-orange-500/10 dark:bg-orange-400/10',
    barColor: 'bg-orange-500 dark:bg-orange-400',
    // Hex colors (for recharts)
    hexColor: '#f97316',
    hexColorDark: '#fb923c',
  },
  under_pace: {
    label: 'Economizando',
    labelCapitalized: 'Economizando',
    description: 'Você está abaixo do ritmo esperado',
    // Tailwind classes
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-500/10 dark:bg-blue-400/10',
    barColor: 'bg-blue-500 dark:bg-blue-400',
    // Hex colors (for recharts)
    hexColor: '#3b82f6',
    hexColorDark: '#60a5fa',
  },
} as const;
