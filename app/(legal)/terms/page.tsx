import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

export const metadata: Metadata = {
  title: 'Termos de Serviço | Fluxo.sh',
  description: 'Regras de uso do Fluxo.sh e condições do serviço.',
};

export default async function TermsOfServicePage() {
  const t = await getTranslations('legal');

  const sections = [
    {
      title: t('terms.serviceTitle'),
      body: t('terms.serviceBody'),
    },
    {
      title: t('terms.accountTitle'),
      bullets: [
        t('terms.accountBullet1'),
        t('terms.accountBullet2'),
        t('terms.accountBullet3'),
      ],
    },
    {
      title: t('terms.acceptableUseTitle'),
      bullets: [
        t('terms.acceptableUseBullet1'),
        t('terms.acceptableUseBullet2'),
        t('terms.acceptableUseBullet3'),
        t('terms.acceptableUseBullet4'),
        t('terms.acceptableUseBullet5'),
      ],
    },
    {
      title: t('terms.dataTitle'),
      body: t('terms.dataBody'),
    },
    {
      title: t('terms.billingTitle'),
      body: t('terms.billingBody'),
    },
    {
      title: t('terms.availabilityTitle'),
      body: t('terms.availabilityBody'),
    },
    {
      title: t('terms.disclaimerTitle'),
      body: t('terms.disclaimerBody'),
    },
    {
      title: t('terms.liabilityTitle'),
      body: t('terms.liabilityBody'),
    },
    {
      title: t('terms.terminationTitle'),
      body: t('terms.terminationBody'),
    },
    {
      title: t('terms.lawTitle'),
      body: t('terms.lawBody'),
    },
    {
      title: t('terms.contactTitle'),
      body: t('terms.contactBody'),
    },
  ];

  return (
    <div className="bg-background text-foreground">
      <div className="mx-auto w-full max-w-3xl px-4 py-12 md:px-6">
        <Link
          href="/"
          className="text-xs uppercase tracking-[0.2em] text-foreground/70 hover:text-foreground"
        >
          {t('backToHome')}
        </Link>
        <h1 className="mt-4 text-3xl font-bold">{t('termsTitle')}</h1>
        <p className="mt-2 text-sm text-foreground/70">
          {t('lastUpdated', { date: t('lastUpdatedDate') })}
        </p>
        <p className="mt-6 text-sm text-foreground/80">{t('terms.intro')}</p>

        <div className="mt-10 space-y-8">
          {sections.map((section) => (
            <section key={section.title} className="space-y-3">
              <h2 className="text-lg font-semibold">{section.title}</h2>
              {section.body ? (
                <p className="text-sm text-foreground/80">{section.body}</p>
              ) : null}
              {section.bullets ? (
                <ul className="list-disc space-y-2 pl-5 text-sm text-foreground/80">
                  {section.bullets.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : null}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
