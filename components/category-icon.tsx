import { HugeiconsIcon } from '@hugeicons/react';
import {
  ShoppingBag01Icon,
  Restaurant01Icon,
  Car01Icon,
  Home01Icon,
  HealthIcon,
  PlaneIcon,
  GameController01Icon,
  Book01Icon,
  Wallet01Icon,
  ClothesIcon,
  Wifi01Icon,
  Activity01Icon,
  GiftIcon,
  SparklesIcon,
  Settings01Icon,
  Briefcase01Icon,
  Coffee01Icon,
  Pizza01Icon,
  Dumbbell01Icon,
  Film01Icon,
  BankIcon,
  Bus01Icon,
  MetroIcon,
  School01Icon,
  ElectricHome01Icon,
  Cash01Icon,
  BrushIcon,
  BicycleIcon,
  CoffeeBeansIcon,
  Medicine01Icon,
  MusicNote01Icon,
  FuelStationIcon,
  ParkingAreaCircleIcon,
  HeadphonesIcon,
  HeartAddIcon,
  Hospital01Icon,
} from '@hugeicons/core-free-icons';

export const CATEGORY_ICONS = {
  ShoppingBag01Icon,
  Restaurant01Icon,
  Car01Icon,
  Home01Icon,
  HealthIcon,
  PlaneIcon,
  GameController01Icon,
  Book01Icon,
  Wallet01Icon,
  ClothesIcon,
  Wifi01Icon,
  Activity01Icon,
  GiftIcon,
  SparklesIcon,
  Settings01Icon,
  Briefcase01Icon,
  Coffee01Icon,
  Pizza01Icon,
  Dumbbell01Icon,
  Film01Icon,
  BankIcon,
  Bus01Icon,
  MetroIcon,
  School01Icon,
  ElectricHome01Icon,
  Cash01Icon,
  BrushIcon,
  BicycleIcon,
  CoffeeBeansIcon,
  Medicine01Icon,
  MusicNote01Icon,
  FuelStationIcon,
  ParkingAreaCircleIcon,
  HeadphonesIcon,
  HeartAddIcon,
  Hospital01Icon,
} as const;

export type IconName = keyof typeof CATEGORY_ICONS;

export function isValidIconName(icon: string | null): icon is IconName {
  return icon !== null && icon in CATEGORY_ICONS;
}

export function CategoryIcon({ icon, className }: { icon: string | null; className?: string }) {
  if (!isValidIconName(icon)) return null;
  const IconComponent = CATEGORY_ICONS[icon];
  return <HugeiconsIcon icon={IconComponent} strokeWidth={2} className={className} />;
}
