import { describe, it, expect } from 'vitest';
import en from '@/dictionaries/en.json';
import fr from '@/dictionaries/fr.json';
import { jobTypeLabel, queuedItsChildren, submissionJobTypes } from '@/src/features/jobs/jobs';
import type { Dictionary } from '@/src/types/dictionary';

describe('queuedItsChildren', () => {
  const job = (childrenQueuedAt: string | null, children: unknown[] = []) =>
    ({ childrenQueuedAt, children }) as Parameters<typeof queuedItsChildren>[0];

  it('marks a job that queued jobs, even once retention deleted them', () => {
    expect(queuedItsChildren(job(null, [{ id: 'child-1' }]))).toBe(true);
    expect(queuedItsChildren(job('2026-11-08T00:00:00Z'))).toBe(true);
  });

  it('never marks a job that queued none', () => {
    expect(queuedItsChildren(job(null))).toBe(false);
  });
});

describe('job types', () => {
  it.each([
    ['en', en as Dictionary, 'Status changed', 'Status email'],
    ['fr', fr as Dictionary, 'Statut modifié', 'Courriel de statut'],
  ])('names status-changed and status email jobs in %s', (_language, dict, changed, email) => {
    expect(jobTypeLabel('submission.status-changed', dict)).toEqual({ text: changed });
    expect(jobTypeLabel('submission.status-email', dict)).toEqual({ text: email });
  });

  it.each([
    ['en', en as Dictionary, 'Submitter email copy'],
    ['fr', fr as Dictionary, 'Copie par courriel au soumissionnaire'],
  ])('names submitter email copy jobs in %s', (_language, dict, name) => {
    expect(jobTypeLabel('submission.email-copy', dict)).toEqual({ text: name });
  });

  it("lists submitter email copies among a submission's job types", () => {
    expect(submissionJobTypes()).toContain('submission.email-copy');
  });

  it("lists status changes and their emails among a submission's job types", () => {
    expect(submissionJobTypes()).toEqual(
      expect.arrayContaining(['submission.status-changed', 'submission.status-email']),
    );
  });
});
