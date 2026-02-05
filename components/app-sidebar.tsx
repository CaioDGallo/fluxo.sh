'use client';

import { LogoutButton } from '@/components/logout-button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from '@/components/ui/sidebar';
import {
  Analytics01Icon,
  ArrowDataTransferHorizontalIcon,
  ArrowRight01Icon,
  CreditCardIcon,
  Crown03Icon,
  FileDownloadIcon,
  Invoice03Icon,
  MoneyReceive02Icon,
  MoneySend02Icon,
  Notification02Icon,
  ReceiptDollarIcon,
  Settings01Icon,
  Settings02Icon,
  SparklesIcon,
  Wallet01Icon
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  { key: 'dashboard', href: '/dashboard', icon: ArrowDataTransferHorizontalIcon },
  { key: 'statistics', href: '/statistics', icon: Analytics01Icon },
  { key: 'budgets', href: '/budgets', icon: Invoice03Icon },
  { key: 'expenses', href: '/expenses', icon: MoneySend02Icon },
  { key: 'income', href: '/income', icon: MoneyReceive02Icon },
  { key: 'plan', href: '/settings/plan', icon: Crown03Icon },
  { key: 'bills', href: '/bills', icon: ReceiptDollarIcon },
  { key: 'reminders', href: '/reminders', icon: Notification02Icon },
  { key: 'faturas', href: '/faturas', icon: CreditCardIcon },
];

const settingsItems = [
  { key: 'accounts', href: '/settings/accounts', icon: Wallet01Icon },
  { key: 'categories', href: '/settings/categories', icon: SparklesIcon },
  { key: 'budgets', href: '/settings/budgets', icon: Invoice03Icon },
  { key: 'openFinance', href: '/settings/open-finance', icon: Settings02Icon },
  { key: 'export', href: '/settings/export', icon: FileDownloadIcon },
  { key: 'settings', href: '/settings', icon: Settings02Icon },
];

export function AppSidebar() {
  const t = useTranslations('navigation');
  const pathname = usePathname();

  const isActive = (href: string) => pathname === href;
  const isSettingsActive = pathname.startsWith('/settings');

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        {/* Expanded state: clickable brand link */}
        <Link
          href="/"
          className="flex py-3 gap-1 flex-col items-center font-semibold group-data-[collapsible=icon]:hidden hover:opacity-80 transition-opacity"
        >
          <Image src="/brand-kit/exports/icon-48-light.png" alt="" width={32} height={32} className="dark:hidden" />
          <Image src="/brand-kit/exports/icon-48-dark.png" alt="" width={32} height={32} className="hidden dark:block" />
          {t('fluxosh')}
        </Link>

        {/* Collapsed state: show clickable logo */}
        <SidebarMenu className="hidden group-data-[collapsible=icon]:flex">
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip={t('home')}>
              <Link href="/">
                <Image src="/brand-kit/exports/icon-48-light.png" alt="fluxo.sh" width={24} height={24} className="dark:hidden" />
                <Image src="/brand-kit/exports/icon-48-dark.png" alt="fluxo.sh" width={24} height={24} className="hidden dark:block" />
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{t('navigation')}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton asChild isActive={isActive(item.href)}>
                    <Link href={item.href} prefetch={false}>
                      <HugeiconsIcon icon={item.icon} />
                      <span>{t(item.key)}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}

              <Collapsible defaultOpen={isSettingsActive} className="group/collapsible">
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton isActive={isSettingsActive}>
                      <HugeiconsIcon icon={Settings01Icon} />
                      <span>{t('settings')}</span>
                      <HugeiconsIcon
                        icon={ArrowRight01Icon}
                        className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-90"
                      />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      {settingsItems.map((item) => (
                        <SidebarMenuSubItem key={item.href}>
                          <SidebarMenuSubButton asChild isActive={isActive(item.href)}>
                            <Link href={item.href} prefetch={false}>
                              <HugeiconsIcon icon={item.icon} />
                              <span>{t(item.key)}</span>
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      ))}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <LogoutButton variant="desktop" />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
