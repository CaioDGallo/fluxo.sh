import { NextResponse } from 'next/server';
import { syncCalendarSource, syncAllCalendars } from '@/lib/actions/calendar-sync';
import { getCurrentUserId } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * Manual calendar sync endpoint
 * POST with optional { calendarSourceId: number }
 */
export async function POST(request: Request) {
  try {
    await getCurrentUserId(); // Verify session

    const body = await request.json().catch(() => ({}));
    const { calendarSourceId } = body;

    if (calendarSourceId) {
      // Sync single source
      const result = await syncCalendarSource(calendarSourceId);
      return NextResponse.json(result);
    } else {
      // Sync all user sources
      const results = await syncAllCalendars();
      return NextResponse.json({
        success: true,
        results,
        total: results.length,
        successful: results.filter(r => r.success).length,
      });
    }
  } catch (error) {
    console.error('[calendar-sync] Manual sync failed:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
