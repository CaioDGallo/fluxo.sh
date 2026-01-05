import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/dashboard';
  const type = searchParams.get('type');

  // Validate next parameter to prevent open redirects
  const isValidNext = next.startsWith('/') && !next.includes('//');
  const redirectPath = isValidNext ? next : '/dashboard';

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // For recovery flow, always redirect to reset-password
      if (type === 'recovery') {
        return NextResponse.redirect(`${origin}/reset-password`);
      }
      return NextResponse.redirect(`${origin}${redirectPath}`);
    }
  }

  // Return user to login page with error
  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
