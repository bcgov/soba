'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode, type Ref } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button, InlineAlert } from '@bcgov/design-system-react-components';
import { CenteredProgress } from '@/app/ui/base/CenteredProgress';
import { ConfirmModal } from '@/src/components/ConfirmModal';
import { ListPageAuthGate } from '@/src/components/ListPageLayout';
import { SecondaryText } from '@/src/components/SecondaryText';
import { StatusTag } from '@/src/components/StatusTag';
import { useDictionary } from '@/app/[lang]/Providers';
import { useKeycloak } from '@/lib/hooks/useKeycloak';
import { useNotificationStore } from '@/lib/hooks/useNotificationStore';
import { isConflict } from '@/src/shared/api/dataError';
import { useDataErrorNotice } from '@/src/shared/api/useDataErrorNotice';
import { useFormatLongDateTime } from '@/src/shared/hooks/useFormatLongDate';
import { JOBS_LIST_QUERY, listLink, navLink } from '@/src/shared/list/listQueryMemory';
import { getLocaleFromPath } from '@/src/shared/util/locale';
import { fillTemplate } from '@/src/shared/util/stringUtils';
import { isUuid } from '@/src/shared/util/uuid';
import type { JobDetail, JobEmailCounts, JobSummary, JobTypeItem } from '@/src/types/admin';
import type { Dictionary } from '@/src/types/dictionary';
import { useJob, useJobTypes, useJobWriter } from '../data/useAdminData';
import { useIsSobaAdmin } from '../useIsSobaAdmin';
import {
  canRerunJob,
  isActiveJobStatus,
  jobStatusVariant,
  jobTypeLabel,
  queuedItsActions,
  type JobTypeLabel,
} from '../jobs';
import styles from './AdminPanel.module.css';

type JobAction = 'rerun' | 'stop';

type FactProps = Readonly<{ name: string; testId: string; children: ReactNode }>;

const Fact = ({ name, testId, children }: FactProps) => (
  <>
    <dt className="col-sm-4">{name}</dt>
    <dd className="col-sm-8" data-testid={`job-fact-${testId}`}>
      {children}
    </dd>
  </>
);

const Label = ({ label }: Readonly<{ label: JobTypeLabel }>) => (
  <span lang={label.lang}>{label.text}</span>
);

type JobLinkProps = Readonly<{
  job: JobSummary;
  locale: string;
  dict: Dictionary;
  types: readonly JobTypeItem[];
}>;

function JobLink({ job, locale, dict, types }: JobLinkProps) {
  return (
    <div className="d-inline-flex align-items-center gap-2">
      <Link href={`/${locale}/admin/jobs/${job.id}`} data-testid={`job-related-${job.id}`}>
        <Label label={jobTypeLabel(job.type, dict, types)} />
      </Link>
      <StatusTag
        label={dict.admin.jobs.statuses[job.status]}
        variant={jobStatusVariant(job.status)}
      />
    </div>
  );
}

type JobFactsProps = Readonly<{
  job: JobDetail;
  locale: string;
  types: readonly JobTypeItem[];
}>;

function JobFacts({ job, locale, types }: JobFactsProps) {
  const dict = useDictionary();
  const dictJobs = dict.admin.jobs;
  const facts = dictJobs.detail.facts;
  const formatDateTime = useFormatLongDateTime();
  const none = dictJobs.detail.none;
  const when = (value: string | null) => (value ? formatDateTime(value) : '—');
  const jobsLink = (params: Record<string, string>) =>
    listLink(`/${locale}/admin/jobs`, JOBS_LIST_QUERY, params);
  const related = { locale, dict, types };

  return (
    <dl className="row">
      <Fact name={facts.type} testId="type">
        <Label label={jobTypeLabel(job.type, dict, types)} />
      </Fact>
      <Fact name={facts.attempts} testId="attempts">
        {fillTemplate(dictJobs.attemptsValue, {
          attempts: String(job.attempts),
          max: String(job.maxAttempts),
        })}
      </Fact>
      <Fact name={facts.workspace} testId="workspace">
        <span className="d-inline-flex flex-column">
          <span>{job.workspaceName}</span>
          <SecondaryText>{job.workspaceId}</SecondaryText>
        </span>
      </Fact>
      <Fact name={facts.form} testId="form">
        {job.formId ? (
          <span className="d-inline-flex flex-column">
            <span>{job.formName ?? dict.general.unknown}</span>
            <SecondaryText>{job.formId}</SecondaryText>
            <Link href={jobsLink({ formId: job.formId })} data-testid="job-form-jobs">
              {dictJobs.detail.formJobs}
            </Link>
          </span>
        ) : (
          '—'
        )}
      </Fact>
      <Fact name={facts.submission} testId="submission">
        {job.submissionId ? (
          <span className="d-inline-flex flex-column">
            <SecondaryText>{job.submissionId}</SecondaryText>
            <Link
              href={jobsLink({ submissionId: job.submissionId })}
              data-testid="job-submission-jobs"
            >
              {dictJobs.detail.submissionJobs}
            </Link>
          </span>
        ) : (
          '—'
        )}
      </Fact>
      <Fact name={facts.revision} testId="revision">
        {job.revisionId ? <SecondaryText>{job.revisionId}</SecondaryText> : '—'}
      </Fact>
      <Fact name={facts.created} testId="created">
        {fillTemplate(dictJobs.detail.byValue, {
          at: formatDateTime(job.createdAt),
          by: job.createdBy.displayLabel ?? dict.general.unknown,
        })}
      </Fact>
      <Fact name={facts.started} testId="started">
        {when(job.startedAt)}
      </Fact>
      {job.status === 'queued' ? (
        <Fact name={facts.nextAttempt} testId="next-attempt">
          {formatDateTime(job.runAfter)}
        </Fact>
      ) : null}
      <Fact name={facts.finished} testId="finished">
        {when(job.finishedAt)}
      </Fact>
      {job.cancelRequestedAt ? (
        <Fact name={facts.stopRequested} testId="stop-requested">
          {formatDateTime(job.cancelRequestedAt)}
        </Fact>
      ) : null}
      <Fact name={facts.reruns} testId="reruns">
        {job.lastRequeuedAt
          ? fillTemplate(dictJobs.detail.rerunsValue, {
              count: String(job.requeueCount),
              at: formatDateTime(job.lastRequeuedAt),
              by: job.lastRequeuedBy?.displayLabel ?? dict.general.unknown,
            })
          : String(job.requeueCount)}
      </Fact>
      <Fact name={facts.lastError} testId="last-error">
        {job.lastError ? <span lang="en">{job.lastError}</span> : '—'}
      </Fact>
      <Fact name={facts.options} testId="options">
        {job.optionNames.length > 0 ? job.optionNames.join(', ') : none}
      </Fact>
      {job.recordedActions.length > 0 ? (
        <Fact name={facts.recordedActions} testId="recorded-actions">
          {job.recordedActions.map((code, index) => (
            <span key={code}>
              {index > 0 ? ', ' : null}
              <Label label={jobTypeLabel(code, dict, types)} />
            </span>
          ))}
        </Fact>
      ) : null}
      {job.parentJobId ? (
        <Fact name={facts.parent} testId="parent">
          {job.parent ? <JobLink job={job.parent} {...related} /> : dictJobs.detail.parentGone}
        </Fact>
      ) : null}
      {job.children.length > 0 ? (
        <Fact name={facts.children} testId="children">
          <ul className="list-unstyled mb-0">
            {job.children.map((child) => (
              <li key={child.id}>
                <JobLink job={child} {...related} />
              </li>
            ))}
          </ul>
        </Fact>
      ) : null}
    </dl>
  );
}

function JobEmails({ counts }: Readonly<{ counts: JobEmailCounts }>) {
  const dict = useDictionary();
  const dictEmails = dict.admin.jobs.detail.emails;
  return (
    <section aria-labelledby="job-emails-heading" data-testid="job-emails">
      <h2 id="job-emails-heading" className="h5">
        {dictEmails.heading}
      </h2>
      <dl className="row">
        <Fact name={dictEmails.addresses} testId="emails-addresses">
          {counts.addresses}
        </Fact>
        <Fact name={dictEmails.sent} testId="emails-sent">
          {counts.sent}
        </Fact>
        <Fact name={dictEmails.refused} testId="emails-refused">
          {counts.refused}
        </Fact>
        <Fact name={dictEmails.pending} testId="emails-pending">
          {counts.pending}
        </Fact>
      </dl>
    </section>
  );
}

type JobViewProps = Readonly<{
  job: JobDetail;
  /** The last read failed; the page shows what it read before and keeps trying. */
  refreshFailed: boolean;
  refresh: () => Promise<void>;
  locale: string;
  types: readonly JobTypeItem[];
  back: ReactNode;
}>;

type JobStatusLineProps = Readonly<{
  job: JobDetail;
  refreshFailed: boolean;
  ref: Ref<HTMLDivElement>;
}>;

/**
 * Announced as it changes while the page follows the job. A div, not a p or an output, which take
 * text only: the status tag renders a div.
 */
function JobStatusLine({ job, refreshFailed, ref }: JobStatusLineProps) {
  const dict = useDictionary();
  const dictDetail = dict.admin.jobs.detail;
  return (
    <div
      ref={ref}
      tabIndex={-1}
      aria-live="polite"
      aria-atomic="true"
      className="mb-3"
      data-testid="job-status-line"
    >
      <div className="d-flex align-items-center gap-2">
        <span>{dictDetail.facts.status}</span>
        <StatusTag
          label={dict.admin.jobs.statuses[job.status]}
          variant={jobStatusVariant(job.status)}
          data-testid="job-status"
        />
        {isActiveJobStatus(job.status) && job.cancelRequestedAt ? (
          <SecondaryText>{dictDetail.stopPending}</SecondaryText>
        ) : null}
      </div>
      {refreshFailed ? (
        <SecondaryText data-testid="job-refresh-error">{dictDetail.refreshError}</SecondaryText>
      ) : null}
    </div>
  );
}

/** The job's status, Run again or Stop as it allows, and its facts. */
function JobView({ job, refreshFailed, refresh, locale, types, back }: JobViewProps) {
  const dict = useDictionary();
  const dictDetail = dict.admin.jobs.detail;
  const { token } = useKeycloak();
  const { addNotification } = useNotificationStore();
  const notifyError = useDataErrorNotice();
  const { rerun, stop } = useJobWriter();
  // Kept after the dialog closes, so its text does not change while it fades out.
  const [action, setAction] = useState<JobAction>('rerun');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const focusStatusOnClose = useRef(false);
  const statusRef = useRef<HTMLDivElement>(null);

  // The button that opened the dialog can be gone once the job changes, so focus goes to the
  // status line instead. Moved after the dialog closes: while it is open it keeps focus inside it.
  useEffect(() => {
    if (confirmOpen || !focusStatusOnClose.current) return;
    focusStatusOnClose.current = false;
    statusRef.current?.focus();
  }, [confirmOpen]);

  const confirm = (next: JobAction) => {
    setAction(next);
    setConfirmOpen(true);
  };

  const handleConfirm = useCallback(() => {
    if (!token) return;
    setPending(true);
    const done =
      action === 'rerun'
        ? rerun(token, job.id).then(() => dictDetail.rerunSuccess)
        : stop(token, job.id).then((outcome) =>
            outcome.status === 'applied' && outcome.value.stopped
              ? dictDetail.stopSuccess
              : dictDetail.stopRequested,
          );
    done
      .then((text) => addNotification({ text, type: 'success' }))
      .catch((cause: unknown) => {
        if (isConflict(cause)) {
          // The job changed since it was read; the server says how, in English.
          notifyError(cause, {
            failed: fillTemplate(dictDetail.refused, { reason: (cause as Error).message }),
          });
          void refresh();
          return;
        }
        notifyError(cause, {
          failed: action === 'rerun' ? dictDetail.rerunError : dictDetail.stopError,
          notFound: dictDetail.notFound,
        });
      })
      .finally(() => {
        focusStatusOnClose.current = true;
        setPending(false);
        setConfirmOpen(false);
      });
  }, [token, action, job.id, rerun, stop, refresh, addNotification, notifyError, dictDetail]);

  const counts = job.emailCounts;
  const rerunMessage = counts
    ? `${dictDetail.rerunMessage} ${fillTemplate(dictDetail.rerunEmails, {
        count: String(counts.pending + counts.refused),
      })}`
    : dictDetail.rerunMessage;
  const rerunnable = canRerunJob(job.status);
  const actionsQueued = rerunnable && queuedItsActions(job);
  const canStop = isActiveJobStatus(job.status) && job.cancelRequestedAt === null;
  const stopping = action === 'stop';

  return (
    <div>
      {back}
      <JobStatusLine job={job} refreshFailed={refreshFailed} ref={statusRef} />
      <div className={`${styles.actions} mb-4`}>
        {rerunnable && !actionsQueued ? (
          <Button
            variant="primary"
            isDisabled={pending}
            onPress={() => confirm('rerun')}
            data-testid="job-rerun"
          >
            {dictDetail.rerun}
          </Button>
        ) : null}
        {canStop ? (
          <Button
            variant="secondary"
            isDisabled={pending}
            onPress={() => confirm('stop')}
            data-testid="job-stop"
          >
            {dictDetail.stop}
          </Button>
        ) : null}
      </div>
      {actionsQueued ? <p data-testid="job-actions-queued">{dictDetail.actionsQueued}</p> : null}

      <JobFacts job={job} locale={locale} types={types} />
      {counts ? <JobEmails counts={counts} /> : null}

      <ConfirmModal
        show={confirmOpen}
        title={stopping ? dictDetail.stopTitle : dictDetail.rerunTitle}
        message={stopping ? dictDetail.stopMessage : rerunMessage}
        confirmLabel={stopping ? dictDetail.stop : dictDetail.rerun}
        pending={pending}
        onConfirm={handleConfirm}
        onCancel={() => {
          // The action in flight closes the dialog when it settles.
          if (!pending) setConfirmOpen(false);
        }}
      />
    </div>
  );
}

/** One background job for platform administrators: its facts, its related jobs, and Run again or Stop. */
export function JobDetailPanel({ jobId }: Readonly<{ jobId: string }>) {
  const dict = useDictionary();
  const dictDetail = dict.admin.jobs.detail;
  const { authenticated } = useKeycloak();
  const { isSobaAdmin, initializing } = useIsSobaAdmin();
  const locale = getLocaleFromPath(usePathname());

  const types = useJobTypes(isSobaAdmin);
  const knownId = isUuid(jobId);
  const { data: job, isLoading, error, refresh } = useJob(isSobaAdmin && knownId ? jobId : null);

  if (initializing) {
    return <CenteredProgress label={dict.general.loading} />;
  }
  if (!authenticated) {
    return <ListPageAuthGate>{dict.general.notAuthenticated}</ListPageAuthGate>;
  }
  if (!isSobaAdmin) {
    return <ListPageAuthGate>{dict.admin.forbidden}</ListPageAuthGate>;
  }
  if (isLoading) {
    return <CenteredProgress label={dict.general.loading} />;
  }

  const back = (
    <p>
      <Link href={navLink(`/${locale}/admin/jobs`)} data-testid="job-back">
        {dictDetail.back}
      </Link>
    </p>
  );

  if (!job) {
    const notFound = !knownId || error?.kind === 'notFound';
    return (
      <div>
        {back}
        <InlineAlert
          title={dictDetail.heading}
          description={notFound ? dictDetail.notFound : dictDetail.loadError}
          variant={notFound ? 'info' : 'warning'}
          data-testid="job-load-error"
        />
      </div>
    );
  }

  return (
    <JobView
      job={job}
      refreshFailed={error !== null}
      refresh={refresh}
      locale={locale}
      types={types}
      back={back}
    />
  );
}

export default JobDetailPanel;
