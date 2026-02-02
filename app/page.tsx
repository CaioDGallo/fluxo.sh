import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { HeroTitle } from '@/components/hero-title';
import { PricingSection } from '@/components/landing/pricing-section';
import { LandingHeader } from '@/components/landing/landing-header';
import { LandingPageTracker } from '@/components/tracking/landing-page-tracker';
import { LandingSectionObserver } from '@/components/tracking/landing-section-observer';
import { LandingCtaTracker } from '@/components/tracking/landing-cta-tracker';
import { LandingWaitlistForm } from '@/components/tracking/landing-waitlist-form';

export const metadata: Metadata = {
  title: 'Fluxo.sh | Decisões financeiras diárias',
  description: 'Meu Fluxo mostra quanto você pode gastar hoje, o ritmo do mês e parcelas no mês certo.',
  openGraph: {
    title: 'Fluxo.sh | Decisões diárias',
    description: 'Disponível por dia, ritmo de gastos e parcelas no mês certo com o Meu Fluxo.',
    type: 'website',
  },
};

export default async function Home() {
  const t = await getTranslations('landing');
  const tLegal = await getTranslations('legal');

  return (
    <LandingPageTracker>
      <div className="bg-background text-foreground">
        <LandingHeader />

        <main>
          <LandingSectionObserver sectionId="hero">
            <section className="relative overflow-hidden border-b border-border/80">
              <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,#f5f5f5_0%,#ffffff_45%,#e9e9e9_100%)] dark:bg-[linear-gradient(120deg,#0d0d0d_0%,#171717_45%,#101010_100%)]" />
              <div className="relative mx-auto grid w-full max-w-6xl gap-10 px-4 py-16 md:grid-cols-[1.1fr_0.9fr] md:px-6 md:py-24">
                <div className="space-y-6">
                  <Badge variant="outline" className="border-foreground text-foreground bg-background/80 dark:bg-background/10">
                    {t('heroBadge')}
                  </Badge>
                  <HeroTitle className="text-4xl font-black leading-tight md:text-5xl" />
                  <p className="text-base text-foreground/80 md:text-lg">
                    {t('subtitle')}
                  </p>
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <LandingCtaTracker
                      ctaType="primary"
                      ctaText={t('ctaPrimary')}
                      ctaLocation="hero"
                      destination="#espera"
                    >
                      <Button variant="popout" asChild>
                        <a href="#espera">{t('ctaPrimary')}</a>
                      </Button>
                    </LandingCtaTracker>
                    <LandingCtaTracker
                      ctaType="secondary"
                      ctaText={t('ctaSecondary')}
                      ctaLocation="hero"
                      destination="#metodo"
                    >
                      <Button variant="hollow" asChild>
                        <a href="#metodo">{t('ctaSecondary')}</a>
                      </Button>
                    </LandingCtaTracker>
                  </div>
                  <p className="text-xs uppercase tracking-[0.25em] text-foreground/80">
                    {t('tagline')}
                  </p>
                </div>

                <div className="space-y-4">
                  <Card className="border-2 border-foreground shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
                    <CardHeader className="border-b border-border">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">{t('footerTitle')}</CardTitle>
                        <Badge variant="outline" className="border-foreground text-foreground">BR</Badge>
                      </div>
                      <CardDescription>{t('statsTitle')}</CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-4">
                      <div className="flex items-center justify-between border border-border px-3 py-3 text-xs">
                        <span className="font-medium">{t('statsOneLabel')}</span>
                        <span className="font-semibold">{t('statsOneValue')}</span>
                      </div>
                      <div className="flex items-center justify-between border border-border px-3 py-3 text-xs">
                        <span className="font-medium">{t('statsTwoLabel')}</span>
                        <span className="font-semibold">{t('statsTwoValue')}</span>
                      </div>
                      <div className="flex items-center justify-between border border-border px-3 py-3 text-xs">
                        <span className="font-medium">{t('statsThreeLabel')}</span>
                        <span className="font-semibold">{t('statsThreeValue')}</span>
                      </div>
                    </CardContent>
                  </Card>

                  <div className="grid gap-4 sm:grid-cols-2">
                    {[
                      { label: t('featureOneTitle'), value: '01' },
                      { label: t('featureTwoTitle'), value: '02' },
                      { label: t('featureThreeTitle'), value: '03' },
                      { label: t('featureFourTitle'), value: '04' },
                    ].map((item) => (
                      <div
                        key={item.value}
                        className="flex items-center justify-between border-2 border-foreground bg-background px-4 py-4 text-xs font-semibold shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                      >
                        <span>{item.label}</span>
                        <span className="text-sm">{item.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          </LandingSectionObserver>

          <LandingSectionObserver sectionId="metodo">
            <section id="metodo" className="border-b border-border/80 bg-background">
              <div className="mx-auto w-full max-w-6xl px-4 py-16 md:px-6">
                <div className="mb-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                  <div className="max-w-xl space-y-3">
                    <h2 className="text-2xl font-bold md:text-3xl">{t('methodTitle')}</h2>
                    <p className="text-sm text-foreground/80 md:text-base">{t('methodSubtitle')}</p>
                  </div>
                  <div className="max-w-sm border border-border bg-background/80 p-4 text-xs text-foreground/80">
                    <p className="text-xs tracking-[0.2em] text-foreground/70">
                      {t('methodPresets')}
                    </p>
                  </div>
                </div>
                <div className="grid gap-6 md:grid-cols-3">
                  {[
                    { title: t('methodNeedTitle'), text: t('methodNeedText'), value: '50%' },
                    { title: t('methodWantsTitle'), text: t('methodWantsText'), value: '30%' },
                    { title: t('methodSavingsTitle'), text: t('methodSavingsText'), value: '20%' },
                  ].map((item) => (
                    <Card
                      key={item.value}
                      className="border-2 border-foreground shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]"
                    >
                      <CardHeader className="border-b border-border">
                        <div className="flex items-center justify-between">
                          <CardTitle>{item.title}</CardTitle>
                          <Badge variant="outline" className="border-foreground text-foreground">
                            {item.value}
                          </Badge>
                        </div>
                        <CardDescription>{item.text}</CardDescription>
                      </CardHeader>
                    </Card>
                  ))}
                </div>
              </div>
            </section>
          </LandingSectionObserver>

          <LandingSectionObserver sectionId="meu-fluxo">
            <section id="meu-fluxo" className="border-b border-border/80 bg-muted dark:bg-muted/40">
              <div className="mx-auto w-full max-w-6xl px-4 py-16 md:px-6">
                <div className="mb-10 max-w-xl space-y-3">
                  <h2 className="text-2xl font-bold md:text-3xl">{t('flowTitle')}</h2>
                  <p className="text-sm text-foreground/80 md:text-base">{t('flowSubtitle')}</p>
                </div>
                <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
                  <Card className="border-2 border-foreground shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
                    <CardHeader className="border-b border-border">
                      <CardTitle>{t('flowCardTitle')}</CardTitle>
                      <CardDescription>{t('flowCardSubtitle')}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div>
                        <div className="flex items-baseline gap-2">
                          <span className="text-4xl font-black">{t('flowDailyAmount')}</span>
                          <span className="text-sm text-foreground/70">{t('flowPerDay')}</span>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-foreground/80">
                          <span className="font-semibold">{t('flowRemainingAmount')}</span>
                          <span>{t('flowRemainingLabel')}</span>
                          <span className="text-foreground/50">•</span>
                          <span>{t('flowDaysRemaining')}</span>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold uppercase tracking-[0.2em] text-foreground/70">
                            {t('flowPaceLabel')}
                          </span>
                          <span className="font-semibold">{t('flowPaceStatus')}</span>
                        </div>
                        <p className="text-xs text-foreground/70">{t('flowPaceDescription')}</p>
                        <div className="relative h-8 overflow-hidden border-2 border-foreground bg-background">
                          <div className="absolute inset-0 flex">
                            <div className="w-[45%] bg-blue-400/80" />
                            <div className="w-[10%] bg-green-400/80" />
                            <div className="w-[10%] bg-orange-400/80" />
                            <div className="w-[35%] bg-red-400/80" />
                          </div>
                          <div
                            className="absolute inset-y-0 left-[51%] w-2 border-2 border-foreground bg-background shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                            style={{ transform: 'translateX(-50%)' }}
                          />
                        </div>
                        <div className="flex justify-between text-[10px] text-foreground/70">
                          <span className="text-left">
                            {t('flowPaceSaving')}
                            <br />
                            <span className="text-[9px]">{t('flowPaceSavingRange')}</span>
                          </span>
                          <span className="text-center">
                            {t('flowPaceOnTrack')}
                            <br />
                            <span className="text-[9px]">{t('flowPaceOnTrackRange')}</span>
                          </span>
                          <span className="text-center">
                            {t('flowPaceCareful')}
                            <br />
                            <span className="text-[9px]">{t('flowPaceCarefulRange')}</span>
                          </span>
                          <span className="text-right">
                            {t('flowPaceOver')}
                            <br />
                            <span className="text-[9px]">{t('flowPaceOverRange')}</span>
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-2 border-foreground shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
                    <CardHeader className="border-b border-border">
                      <CardTitle>{t('flowBucketTitle')}</CardTitle>
                      <CardDescription>{t('flowBucketSubtitle')}</CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-4">
                      {[
                        {
                          title: t('flowBucketNecessitiesTitle'),
                          amount: t('flowBucketNecessitiesAmount'),
                          percent: t('flowBucketNecessitiesPercent'),
                          bar: 'bg-blue-500',
                        },
                        {
                          title: t('flowBucketWantsTitle'),
                          amount: t('flowBucketWantsAmount'),
                          percent: t('flowBucketWantsPercent'),
                          bar: 'bg-amber-500',
                        },
                        {
                          title: t('flowBucketSavingsTitle'),
                          amount: t('flowBucketSavingsAmount'),
                          percent: t('flowBucketSavingsPercent'),
                          bar: 'bg-emerald-500',
                        },
                      ].map((item) => (
                        <div
                          key={item.title}
                          className="border-2 border-foreground bg-background px-4 py-4 text-xs shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-semibold">{item.title}</span>
                            <Badge
                              variant="outline"
                              className="border-foreground text-foreground text-[10px]"
                            >
                              {item.percent}
                            </Badge>
                          </div>
                          <p className="mt-2 text-xs text-foreground/70">{item.amount}</p>
                          <div className="mt-3 h-2 bg-border/50">
                            <div className={`h-full ${item.bar}`} style={{ width: item.percent }} />
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                </div>
              </div>
            </section>
          </LandingSectionObserver>

          <LandingSectionObserver sectionId="recursos">
            <section id="recursos" className="border-b border-border/80 bg-background">
              <div className="mx-auto w-full max-w-6xl px-4 py-16 md:px-6">
                <div className="mb-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                  <div className="max-w-xl space-y-3">
                    <h2 className="text-2xl font-bold md:text-3xl">{t('featureTitle')}</h2>
                    <p className="text-sm text-foreground/80 md:text-base">{t('featureSubtitle')}</p>
                  </div>
                </div>
                <div className="grid gap-6 md:grid-cols-2">
                  <Card className="border-2 border-foreground shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
                    <CardHeader className="border-b border-border">
                      <CardTitle>{t('featureOneTitle')}</CardTitle>
                      <CardDescription>{t('featureOneText')}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid gap-2 text-xs text-foreground/80">
                        <span>• {t('featureOneBulletOne')}</span>
                        <span>• {t('featureOneBulletTwo')}</span>
                        <span>• {t('featureOneBulletThree')}</span>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="border-2 border-foreground shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
                    <CardHeader className="border-b border-border">
                      <CardTitle>{t('featureTwoTitle')}</CardTitle>
                      <CardDescription>{t('featureTwoText')}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid gap-2 text-xs text-foreground/80">
                        <span>• {t('featureTwoBulletOne')}</span>
                        <span>• {t('featureTwoBulletTwo')}</span>
                        <span>• {t('featureTwoBulletThree')}</span>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="border-2 border-foreground shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
                    <CardHeader className="border-b border-border">
                      <CardTitle>{t('featureThreeTitle')}</CardTitle>
                      <CardDescription>{t('featureThreeText')}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid gap-2 text-xs text-foreground/80">
                        <span>• {t('featureThreeBulletOne')}</span>
                        <span>• {t('featureThreeBulletTwo')}</span>
                        <span>• {t('featureThreeBulletThree')}</span>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="border-2 border-foreground shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
                    <CardHeader className="border-b border-border">
                      <CardTitle>{t('featureFourTitle')}</CardTitle>
                      <CardDescription>{t('featureFourText')}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid gap-2 text-xs text-foreground/80">
                        <span>• {t('featureFourBulletOne')}</span>
                        <span>• {t('featureFourBulletTwo')}</span>
                        <span>• {t('featureFourBulletThree')}</span>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </section>
          </LandingSectionObserver>

          <PricingSection />

          <LandingSectionObserver sectionId="como">
            <section id="como" className="border-b border-border/80">
              <div className="mx-auto w-full max-w-6xl px-4 py-16 md:px-6">
                <div className="mb-10 max-w-xl space-y-3">
                  <h2 className="text-2xl font-bold md:text-3xl">{t('howTitle')}</h2>
                  <p className="text-sm text-foreground/80 md:text-base">{t('howSubtitle')}</p>
                </div>
                <div className="grid gap-6 md:grid-cols-3">
                  {[
                    {
                      title: t('howStepOneTitle'),
                      text: t('howStepOneText'),
                      index: '01',
                    },
                    {
                      title: t('howStepTwoTitle'),
                      text: t('howStepTwoText'),
                      index: '02',
                    },
                    {
                      title: t('howStepThreeTitle'),
                      text: t('howStepThreeText'),
                      index: '03',
                    },
                  ].map((item) => (
                    <div
                      key={item.index}
                      className="flex h-full flex-col justify-between border-2 border-foreground bg-background p-6 text-xs shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]"
                    >
                      <span className="text-sm font-semibold">{item.index}</span>
                      <div className="mt-6 space-y-3">
                        <h3 className="text-base font-semibold">{item.title}</h3>
                        <p className="text-foreground/80">{item.text}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </LandingSectionObserver>

          <section className="border-b border-border/80 bg-foreground text-background">
            <div className="mx-auto w-full max-w-6xl px-4 py-16 md:px-6">
              <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.3em]">{t('proofTitle')}</p>
                  <h2 className="mt-3 text-3xl font-black md:text-4xl">{t('proofSubtitle')}</h2>
                </div>
                <LandingCtaTracker
                  ctaType="primary"
                  ctaText={t('ctaPrimary')}
                  ctaLocation="proof"
                  destination="#espera"
                >
                  <Button
                    variant="popout"
                    className="border-2 border-background bg-background text-foreground hover:bg-background hover:text-foreground"
                    asChild
                  >
                    <a href="#espera">{t('ctaPrimary')}</a>
                  </Button>
                </LandingCtaTracker>
              </div>
            </div>
          </section>

          <LandingSectionObserver sectionId="faq">
            <section id="faq" className="border-b border-border/80">
              <div className="mx-auto w-full max-w-6xl px-4 py-16 md:px-6">
                <div className="mb-10 max-w-xl space-y-3">
                  <h2 className="text-2xl font-bold md:text-3xl">{t('faqTitle')}</h2>
                </div>
                <div className="grid gap-6 md:grid-cols-3">
                  {[1, 2, 3].map((item) => (
                    <Card key={item} className="border-2 border-foreground shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
                      <CardHeader className="border-b border-border">
                        <CardTitle>{t(`faq${item}Q` as const)}</CardTitle>
                        <CardDescription>{t(`faq${item}A` as const)}</CardDescription>
                      </CardHeader>
                    </Card>
                  ))}
                </div>
              </div>
            </section>
          </LandingSectionObserver>

          <LandingSectionObserver sectionId="espera">
            <section id="espera" className="border-b border-border/80 bg-muted dark:bg-muted/40">
              <div className="mx-auto w-full max-w-6xl px-4 py-16 md:px-6">
                <Card className="border-2 border-foreground shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
                  <CardHeader className="border-b border-border">
                    <CardTitle className="text-2xl md:text-3xl">{t('ctaTitle')}</CardTitle>
                    <CardDescription className="text-sm md:text-base">{t('ctaSubtitle')}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <LandingWaitlistForm
                      emailLabel={t('emailLabel')}
                      emailPlaceholder={t('emailPlaceholder')}
                      submitNote={t('submitNote')}
                      submitButton={t('waitlistSubmit')}
                      submittingButton={t('waitlistSubmitting')}
                      successMessage={t('waitlistSuccess')}
                      errorDuplicate={t('waitlistErrorDuplicate')}
                      errorRateLimit={t('waitlistErrorRateLimit')}
                      errorInvalid={t('waitlistErrorInvalid')}
                      errorGeneric={t('waitlistErrorGeneric')}
                    />
                    <div className="border border-border p-4 text-xs">
                      <p className="font-semibold">{t('footerTitle')}</p>
                      <p className="text-foreground/80">{t('footerText')}</p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </section>
          </LandingSectionObserver>
        </main>

        <footer className="border-b border-border/80 bg-background">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-10 text-xs md:flex-row md:items-center md:justify-between md:px-6">
            <div>
              <p className="font-semibold">{t('footerTitle')}</p>
              <p className="text-foreground/80">{t('footerText')}</p>
              <div className="mt-3 flex flex-wrap items-center gap-3 text-[10px] uppercase tracking-[0.2em] text-foreground/70">
                <Link href="/privacy" className="hover:text-foreground">
                  {tLegal('privacyLink')}
                </Link>
                <span>•</span>
                <Link href="/terms" className="hover:text-foreground">
                  {tLegal('termsLink')}
                </Link>
              </div>
            </div>
            <div className="flex flex-wrap gap-4 uppercase tracking-[0.2em] text-[10px] text-foreground/80">
              <span>{t('footerMadeIn')}</span>
              <span>•</span>
              <span>{t('footerInstallments')}</span>
              <span>•</span>
              <span>{t('footerDomain')}</span>
            </div>
          </div>
        </footer>
      </div>
    </LandingPageTracker>
  );
}
