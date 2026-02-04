'use client';

import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { HugeiconsIcon } from '@hugeicons/react';
import { SparklesIcon, Wallet01Icon } from '@hugeicons/core-free-icons';
import { AccountForm } from '@/components/account-form';
import { Badge } from '@/components/ui/badge';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { getPluggyConnectToken, initializePluggyItemAccounts, syncPluggyItemById } from '@/lib/actions/pluggy';
import { usePluggyConnect } from '@/lib/hooks/use-pluggy-connect';
import { cn } from '@/lib/utils';

type AccountCreateFlowProps = {
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onSuccess?: () => void;
};

export function AccountCreateFlow({
  trigger,
  open: controlledOpen,
  onOpenChange,
  onSuccess,
}: AccountCreateFlowProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled ? onOpenChange! : setInternalOpen;
  const [manualOpen, setManualOpen] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const connectCompletedRef = useRef(false);
  const router = useRouter();

  const tAccounts = useTranslations('accounts');
  const tCommon = useTranslations('common');
  const tOpenFinance = useTranslations('openFinance');

  const { open: openConnect, isLoading: isConnectLoading, sdkReady } = usePluggyConnect({
    onSuccess: async (pluggyItemId) => {
      connectCompletedRef.current = true;
      setIsConnecting(false);
      toast.success(tOpenFinance('connectSuccess'));
      void syncPluggyItemById(pluggyItemId).catch((error) => {
        console.error('[pluggy:sync] Failed to start:', error);
      });

      try {
        const result = await initializePluggyItemAccounts(pluggyItemId);
        if (result.success) {
          toast.success(tOpenFinance('accountsInitialized', { count: result.result.accountsCreated }));
          onSuccess?.();
        } else {
          toast.error(result.error);
        }
      } catch {
        toast.error(tCommon('unexpectedError'));
      } finally {
        router.refresh();
      }
    },
    onError: (error) => {
      connectCompletedRef.current = false;
      setIsConnecting(false);
      console.error('[pluggy:connect] Failed:', error);
      toast.error(tOpenFinance('connectFailed'));
    },
    onClose: () => {
      setIsConnecting(false);
      if (!connectCompletedRef.current) {
        toast(tOpenFinance('connectCancelled'));
      }
      connectCompletedRef.current = false;
    },
  });

  const isConnectBusy = isConnecting || isConnectLoading;
  const isConnectDisabled = isConnectBusy || !sdkReady;

  async function handleManual() {
    setOpen(false);
    setManualOpen(true);
  }

  async function handleAutomatic() {
    setOpen(false);
    setIsConnecting(true);
    connectCompletedRef.current = false;
    try {
      const result = await getPluggyConnectToken();
      if (result.success) {
        await openConnect(result.token);
      } else {
        toast.error(result.error);
        setIsConnecting(false);
      }
    } catch {
      toast.error(tCommon('unexpectedError'));
      setIsConnecting(false);
    }
  }

  return (
    <>
      <Sheet open={open} onOpenChange={setOpen}>
        {trigger && <SheetTrigger asChild>{trigger}</SheetTrigger>}
        <SheetContent
          side="bottom"
          className="max-h-[80vh] p-0 flex flex-col"
          showCloseButton={false}
        >
          <SheetHeader className="border-b border-border/60 bg-muted/70 dark:bg-muted/20 px-4 py-3">
            <div className="grid grid-cols-[1fr_auto_auto] items-center gap-3">
              <SheetTitle className="text-start text-sm font-semibold text-balance">
                {tAccounts('addAccountFlowTitle')}
              </SheetTitle>
              <div className="flex items-center gap-2">
                <span
                  className="size-4 rounded-full border border-green-700 bg-green-500 shadow-[1px_1px_0px_rgba(0,0,0,0.6)]"
                  aria-hidden
                />
                <span
                  className="size-4 rounded-full border border-amber-600 bg-amber-400 shadow-[1px_1px_0px_rgba(0,0,0,0.6)]"
                  aria-hidden
                />
                <SheetClose asChild>
                  <button
                    type="button"
                    className="group size-4 rounded-full border border-red-700 bg-red-500 text-[10px] font-bold text-red-950 shadow-[1px_1px_0px_rgba(0,0,0,0.6)] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/60"
                    aria-label={tCommon('close')}
                  >
                    <span className="relative block -mt-px text-white leading-none opacity-80 group-hover:opacity-100">
                      <span className="w-14 h-10 absolute -translate-x-1/2 -translate-y-1/2 top-1/2 left-1/2" />
                      x
                    </span>
                  </button>
                </SheetClose>
              </div>
            </div>
            <SheetDescription className="text-xs text-muted-foreground">
              {tAccounts('addAccountFlowDescription')}
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto bg-muted/20 dark:bg-muted px-4 pb-5 pt-4">
            <div className="space-y-3">
              <button
                type="button"
                onClick={handleAutomatic}
                disabled={isConnectDisabled}
                aria-label={tAccounts('addAccountAutomatic')}
                className={cn(
                  'group flex w-full items-start gap-4 rounded-none border border-border/70 bg-background px-4 py-3 text-left transition',
                  'hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  'touch-manipulation',
                  isConnectDisabled && 'cursor-not-allowed opacity-60'
                )}
              >
                <div className="size-10 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
                  <HugeiconsIcon icon={SparklesIcon} strokeWidth={2} className="size-5" />
                </div>
                <div className="flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold">{tAccounts('addAccountAutomatic')}</span>
                    <Badge variant="outline">{tOpenFinance('title')}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {tAccounts('addAccountAutomaticDescription')}
                  </p>
                  {isConnectBusy && (
                    <p className="text-[11px] text-muted-foreground">{tOpenFinance('connectingBank')}</p>
                  )}
                </div>
              </button>

              <button
                type="button"
                onClick={handleManual}
                aria-label={tAccounts('addAccountManual')}
                className={cn(
                  'group flex w-full items-start gap-4 rounded-none border border-border/70 bg-background px-4 py-3 text-left transition',
                  'hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  'touch-manipulation'
                )}
              >
                <div className="size-10 rounded-full bg-slate-500/10 text-slate-700 dark:text-slate-200 flex items-center justify-center shrink-0">
                  <HugeiconsIcon icon={Wallet01Icon} strokeWidth={2} className="size-5" />
                </div>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">{tAccounts('addAccountManual')}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {tAccounts('addAccountManualDescription')}
                  </p>
                </div>
              </button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <AccountForm
        open={manualOpen}
        onOpenChange={setManualOpen}
        onSuccess={onSuccess}
      />
    </>
  );
}
