'use client';

import { useState } from 'react';
import { deleteCalendarSource, updateCalendarSource } from '@/lib/actions/calendar-sources';
import type { CalendarSource } from '@/lib/schema';
import { CalendarSourceForm } from '@/components/calendar-source-form';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { HugeiconsIcon } from '@hugeicons/react';
import { MoreVerticalIcon, Calendar03Icon, Loading03Icon } from '@hugeicons/core-free-icons';
import { useTranslations } from 'next-intl';
import { formatRelativeTime } from '@/lib/utils';

type CalendarSourceCardProps = {
  source: CalendarSource;
};

export function CalendarSourceCard({ source }: CalendarSourceCardProps) {
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const t = useTranslations('calendarSources');
  const tCommon = useTranslations('common');

  const statusColors = {
    active: 'text-green-600',
    error: 'text-red-600',
    disabled: 'text-gray-400',
  };

  async function handleDelete() {
    setIsDeleting(true);
    setDeleteError(null);

    try {
      const result = await deleteCalendarSource(source.id);
      if (result.success) {
        setDeleteOpen(false);
      } else {
        setDeleteError(result.error);
      }
    } catch {
      setDeleteError(tCommon('unexpectedError'));
    } finally {
      setIsDeleting(false);
    }
  }

  async function handleSync() {
    setIsSyncing(true);
    setSyncError(null);

    try {
      const response = await fetch('/api/calendar-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ calendarSourceId: source.id }),
      });

      if (!response.ok) {
        throw new Error('Sync failed');
      }

      const result = await response.json();
      if (!result.success) {
        setSyncError(t('syncFailed'));
      }
    } catch {
      setSyncError(t('syncFailed'));
    } finally {
      setIsSyncing(false);
    }
  }

  async function handleToggleStatus() {
    const newStatus = source.status === 'active' ? 'disabled' : 'active';
    await updateCalendarSource(source.id, { status: newStatus });
  }

  return (
    <Card className="py-0">
      <CardContent className="flex items-center gap-3 md:gap-4 px-3 md:px-4 py-3">
        {/* Calendar icon with color */}
        <div
          className="size-10 shrink-0 rounded-full flex items-center justify-center text-white"
          style={{ backgroundColor: source.color ?? '#3b82f6' }}
        >
          <HugeiconsIcon icon={Calendar03Icon} strokeWidth={2} size={20} />
        </div>

        {/* Name + status */}
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-sm truncate">{source.name}</h3>
          <div className="flex items-center gap-2 text-xs">
            <span className={statusColors[source.status]}>
              {t(`status.${source.status}`)}
            </span>
            {source.lastSyncedAt && (
              <>
                <span className="text-gray-400">•</span>
                <span className="text-gray-500">
                  {t('lastSynced')}: {formatRelativeTime(source.lastSyncedAt)}
                </span>
              </>
            )}
          </div>
          {source.lastError && (
            <p className="text-xs text-red-600 mt-1 truncate">{source.lastError}</p>
          )}
          {syncError && (
            <p className="text-xs text-red-600 mt-1">{syncError}</p>
          )}
        </div>

        {/* Sync Now button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleSync}
          disabled={isSyncing || source.status === 'disabled'}
        >
          <HugeiconsIcon
            icon={Loading03Icon}
            strokeWidth={2}
            size={16}
            className={isSyncing ? 'animate-spin' : ''}
          />
        </Button>

        {/* Actions dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="size-8">
              <HugeiconsIcon icon={MoreVerticalIcon} strokeWidth={2} size={16} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={handleToggleStatus}>
              {source.status === 'active' ? t('disable') : t('enable')}
            </DropdownMenuItem>

            <AlertDialog open={editOpen} onOpenChange={setEditOpen}>
              <AlertDialogTrigger asChild>
                <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                  {tCommon('edit')}
                </DropdownMenuItem>
              </AlertDialogTrigger>
              <AlertDialogContent closeOnBackdropClick>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t('editCalendar')}</AlertDialogTitle>
                </AlertDialogHeader>
                <CalendarSourceForm source={source} onSuccess={() => setEditOpen(false)} />
              </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
              <AlertDialogTrigger asChild>
                <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                  {tCommon('delete')}
                </DropdownMenuItem>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t('deleteCalendar')}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    {t('deleteWarning')}
                  </AlertDialogDescription>
                </AlertDialogHeader>

                {deleteError && (
                  <div className="rounded-md bg-red-50 p-3 text-sm text-red-800">
                    {deleteError}
                  </div>
                )}

                <AlertDialogFooter>
                  <AlertDialogCancel disabled={isDeleting}>{tCommon('cancel')}</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    disabled={isDeleting}
                  >
                    {isDeleting ? tCommon('deleting') : tCommon('delete')}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardContent>
    </Card>
  );
}
