import { NextResponse } from 'next/server';
import { processPluggyWebhook, type PluggyWebhookPayload } from '@/lib/pluggy/webhook';

export const runtime = 'nodejs';
export const maxDuration = 120;

function extractWebhookSecret(request: Request) {
  const header =
    request.headers.get('x-pluggy-signature')
    ?? request.headers.get('x-webhook-signature')
    ?? request.headers.get('x-webhook-secret')
    ?? request.headers.get('authorization');

  if (!header) return null;
  if (header.startsWith('Bearer ')) {
    return header.slice('Bearer '.length).trim();
  }
  return header.trim();
}

export async function POST(request: Request) {
  const webhookSecret = process.env.PLUGGY_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return new NextResponse('PLUGGY_WEBHOOK_SECRET not configured', { status: 500 });
  }

  const provided = extractWebhookSecret(request);
  if (!provided || provided !== webhookSecret) {
    return new NextResponse('Invalid webhook secret', { status: 401 });
  }

  let payload: PluggyWebhookPayload;
  try {
    payload = (await request.json()) as PluggyWebhookPayload;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  if (!payload.event || !payload.eventId) {
    return NextResponse.json(
      { error: 'Missing required fields: event and eventId are required' },
      { status: 400 }
    );
  }

  try {
    await processPluggyWebhook(payload);
    return NextResponse.json({
      received: true,
      event: payload.event,
      eventId: payload.eventId,
    });
  } catch (error) {
    console.error('[pluggy:webhook] Failed to process event:', {
      error: error instanceof Error ? error.message : String(error),
      event: payload.event,
      eventId: payload.eventId,
    });
    return NextResponse.json({ error: 'Failed to process webhook' }, { status: 500 });
  }
}
