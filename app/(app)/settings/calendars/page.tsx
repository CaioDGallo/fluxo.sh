import { getTranslations } from 'next-intl/server';
import { getCalendarSources } from '@/lib/actions/calendar-sources';
import { CalendarSourceForm } from '@/components/calendar-source-form';
import { CalendarSourceCard } from '@/components/calendar-source-card';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

export default async function CalendarsPage() {
  const t = await getTranslations('calendarSources');
  const sources = await getCalendarSources();

  return (
    <div>
      <div className="mb-6 flex items-center flex-col md:flex-row space-y-4 md:space-y-0 justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('title')}</h1>
          <p className="text-sm text-gray-500 mt-1">{t('description')}</p>
        </div>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="hollow">{t('addCalendar')}</Button>
          </AlertDialogTrigger>
          <AlertDialogContent closeOnBackdropClick>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('addCalendar')}</AlertDialogTitle>
            </AlertDialogHeader>
            <CalendarSourceForm />
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <div className="space-y-3">
        {sources.length > 0 ? (
          sources.map((source) => (
            <CalendarSourceCard key={source.id} source={source} />
          ))
        ) : (
          <p className="text-sm text-gray-500">{t('noCalendarsYet')}</p>
        )}
      </div>
    </div>
  );
}
