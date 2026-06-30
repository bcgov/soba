'use client';

import { DsPageHeading } from '@/app/ui/DsPageHeading';
import { ListPageLayout } from '@/src/components/ListPageLayout';
import { useDictionary } from '@/app/[lang]/Providers';

export default function OnboardingPage() {
  const dict = useDictionary();
  const dictOnboarding = dict.onboarding;

  return (
    <ListPageLayout>
      <DsPageHeading id="onboarding-heading">{dictOnboarding.heading}</DsPageHeading>
      <p data-testid="onboarding-placeholder">{dictOnboarding.placeholder}</p>
    </ListPageLayout>
  );
}
