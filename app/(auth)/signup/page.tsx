'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { signIn } from 'next-auth/react';
import { captureEvent, identifyUser } from '@/lib/posthog-client';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { signup } from '@/lib/actions/signup';
import { Turnstile } from '@marsidev/react-turnstile';
import { OAuthButtons } from '@/components/auth/oauth-buttons';

function SignupForm() {
  const searchParams = useSearchParams();
  const t = useTranslations('signup');
  const tLegal = useTranslations('legal');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaKey, setCaptchaKey] = useState(0);
  const redirectParam = searchParams.get('redirect');
  const redirectTo = redirectParam && redirectParam.startsWith('/') ? redirectParam : '/dashboard';

  // Clear error params on mount
  useEffect(() => {
    const errorParam = searchParams.get('error');
    if (errorParam) {
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, [searchParams]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!captchaToken) {
      setError(t('captchaRequired'));
      return;
    }

    setLoading(true);

    try {
      // Create account
      const result = await signup({
        email,
        password,
        name,
        captchaToken,
      });

      if (!result.success) {
        setError(result.error);
        setCaptchaToken(null);
        setCaptchaKey((prev) => prev + 1);
      } else {
        // Track signup
        void (async () => {
          await identifyUser(email, { email, name });
          await captureEvent('signup_success', { email, method: 'credentials' });
        })();

        // Sign in and redirect
        await signIn('credentials', {
          email,
          password,
          captchaToken,
          callbackUrl: redirectTo,
        });
      }
    } catch {
      setError(t('unexpectedError'));
      setCaptchaToken(null);
      setCaptchaKey((prev) => prev + 1);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-muted/50 p-4">
      <Card className="w-full max-w-md">
        <CardContent className="p-6">
          <div className="mb-6">
            <h1 className="text-2xl font-bold">{t('title')}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {t('description')}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">{t('name')}</Label>
              <Input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                disabled={loading}
                placeholder={t('namePlaceholder')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">{t('email')}</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                placeholder={t('emailPlaceholder')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">{t('password')}</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                placeholder={t('passwordPlaceholder')}
              />
              <p className="text-xs text-muted-foreground">
                {t('passwordRequirements')}
              </p>
            </div>

            <div>
              <Turnstile
                key={captchaKey}
                siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY!}
                onSuccess={(token) => setCaptchaToken(token)}
                onError={() => setCaptchaToken(null)}
                onExpire={() => setCaptchaToken(null)}
              />
            </div>

            {error && (
              <div className="rounded-md bg-red-50 p-3 text-sm text-red-800">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={loading || !captchaToken}>
              {loading ? t('creatingAccount') : t('createAccount')}
            </Button>
          </form>

          <OAuthButtons className="mt-4" callbackUrl={redirectTo} />

          <div className="mt-4 text-center text-sm text-muted-foreground">
            {t('alreadyHaveAccount')}{' '}
            <Link href="/login" className="font-medium hover:underline">
              {t('signIn')}
            </Link>
          </div>
          <div className="mt-4 text-center text-xs text-muted-foreground">
            {tLegal('agreementPrefix')}
            <Link href="/terms" className="font-medium underline underline-offset-4">
              {tLegal('termsLink')}
            </Link>
            {tLegal('agreementMiddle')}
            <Link href="/privacy" className="font-medium underline underline-offset-4">
              {tLegal('privacyLink')}
            </Link>
            {tLegal('agreementSuffix')}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={<SignupFallback />}>
      <SignupForm />
    </Suspense>
  );
}

function SignupFallback() {
  const t = useTranslations('signup');

  return (
    <div className="flex min-h-dvh items-center justify-center bg-muted/50 p-4">
      <Card className="w-full max-w-md">
        <CardContent className="p-6">
          <div className="mb-6">
            <h1 className="text-2xl font-bold">{t('title')}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{t('loading')}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
