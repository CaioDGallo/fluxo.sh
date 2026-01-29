import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

export const metadata: Metadata = {
  title: 'Política de Privacidade | Fluxo.sh',
  description: 'Como o Fluxo.sh trata seus dados pessoais e financeiros.',
};

export default async function PrivacyPolicyPage() {
  const t = await getTranslations('legal');

  const summaryItems = [
    t('privacy.summaryBullet1'),
    t('privacy.summaryBullet2'),
    t('privacy.summaryBullet3'),
    t('privacy.summaryBullet4'),
  ];

  const sections = [
    {
      title: t('privacy.dataTitle'),
      body: t('privacy.dataIntro'),
      bullets: [
        t('privacy.dataBullet1'),
        t('privacy.dataBullet2'),
        t('privacy.dataBullet3'),
        t('privacy.dataBullet4'),
        t('privacy.dataBullet5'),
      ],
    },
    {
      title: t('privacy.useTitle'),
      bullets: [
        t('privacy.useBullet1'),
        t('privacy.useBullet2'),
        t('privacy.useBullet3'),
        t('privacy.useBullet4'),
        t('privacy.useBullet5'),
        t('privacy.useBullet6'),
      ],
    },
    {
      title: t('privacy.sharingTitle'),
      body: t('privacy.sharingBody'),
      bullets: [
        t('privacy.sharingBullet1'),
        t('privacy.sharingBullet2'),
        t('privacy.sharingBullet3'),
        t('privacy.sharingBullet4'),
        t('privacy.sharingBullet5'),
        t('privacy.sharingBullet6'),
        t('privacy.sharingBullet7'),
      ],
    },
    {
      title: t('privacy.aiTitle'),
      body: t('privacy.aiBody'),
    },
    {
      title: t('privacy.ownershipTitle'),
      body: t('privacy.ownershipBody'),
    },
    {
      title: t('privacy.retentionTitle'),
      body: t('privacy.retentionBody'),
    },
    {
      title: t('privacy.securityTitle'),
      body: t('privacy.securityBody'),
    },
    {
      title: t('privacy.rightsTitle'),
      body: t('privacy.rightsBody'),
    },
    {
      title: t('privacy.contactTitle'),
      body: t('privacy.contactBody'),
    },
    {
      title: t('privacy.updatesTitle'),
      body: t('privacy.updatesBody'),
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
        <h1 className="mt-4 text-3xl font-bold">{t('privacyTitle')}</h1>
        <p className="mt-2 text-sm text-foreground/70">
          {t('lastUpdated', { date: t('lastUpdatedDate') })}
        </p>

        <section className="mt-8 space-y-3">
          <h2 className="text-lg font-semibold">{t('privacy.summaryTitle')}</h2>
          <ul className="list-disc space-y-2 pl-5 text-sm text-foreground/80">
            {summaryItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>

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
