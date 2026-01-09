import { NextResponse } from 'next/server';
import { fetchICalUrl } from '@/lib/ical/fetch';
import { parseICalendar } from '@/lib/ical/parser';
import { getCurrentUserId } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * Test iCal URL endpoint
 * POST with { url: string }
 */
export async function POST(request: Request) {
  try {
    await getCurrentUserId(); // Verify session

    const body = await request.json();
    const { url } = body;

    if (!url) {
      return NextResponse.json(
        { success: false, error: 'URL is required' },
        { status: 400 }
      );
    }

    // Fetch iCal data
    const fetchResult = await fetchICalUrl(url);
    if (!fetchResult.success || !fetchResult.data) {
      return NextResponse.json({
        success: false,
        error: fetchResult.error || 'Failed to fetch calendar',
      });
    }

    // Parse iCal content
    try {
      const calendar = parseICalendar(fetchResult.data);

      return NextResponse.json({
        success: true,
        calendarName: calendar.name || 'Unnamed Calendar',
        eventCount: calendar.events.length,
      });
    } catch (parseError) {
      return NextResponse.json({
        success: false,
        error: parseError instanceof Error ? parseError.message : 'Failed to parse calendar',
      });
    }
  } catch (error) {
    console.error('[calendar-sync:test] Test failed:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
