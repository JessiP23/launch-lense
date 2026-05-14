import { LegalPage } from '@/components/legal/legal-page';
import { createServiceClient } from '@/lib/supabase';
import { notFound } from 'next/navigation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const STATUS_LABELS: Record<string, { label: string; description: string }> = {
  pending_verification: {
    label: 'Pending email verification',
    description:
      'Waiting for you to click the verification link we emailed. The deletion cascade will start as soon as you confirm.',
  },
  pending_cascade: {
    label: 'Queued',
    description: 'Your deletion request has been verified and is queued. Cascade typically finishes in a few minutes.',
  },
  in_progress: {
    label: 'In progress',
    description:
      'We are pausing campaigns, deleting Meta objects, and purging your records.',
  },
  completed: {
    label: 'Completed',
    description:
      'All identifiable data has been permanently deleted. Aggregate, de-identified benchmarks may remain.',
  },
  failed: {
    label: 'Failed',
    description:
      'The cascade hit an error. Our team has been notified. Email privacy@launchlense.app if this persists.',
  },
};

export default async function DataDeletionStatusPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const db = createServiceClient();

  const { data, error } = await db
    .from('data_deletion_requests')
    .select('confirmation_id, status, source, created_at, completed_at')
    .eq('confirmation_id', code)
    .maybeSingle();

  if (error || !data) notFound();

  const meta = STATUS_LABELS[data.status as string] ?? {
    label: data.status as string,
    description: 'Status unknown — contact privacy@launchlense.app.',
  };

  return (
    <LegalPage title="Deletion status" lastUpdated={new Date().toISOString().slice(0, 10)}>
      <h2>{meta.label}</h2>
      <p>{meta.description}</p>
      <p>
        <strong>Confirmation code:</strong> <code>{data.confirmation_id}</code>
        <br />
        <strong>Source:</strong> {data.source}
        <br />
        <strong>Requested at:</strong> {new Date(data.created_at as string).toUTCString()}
        {data.completed_at ? (
          <>
            <br />
            <strong>Completed at:</strong>{' '}
            {new Date(data.completed_at as string).toUTCString()}
          </>
        ) : null}
      </p>
      <p>
        Refresh this page for the latest status. Meta&apos;s data-deletion
        polling honours the same JSON via the API at{' '}
        <code>/api/data-deletion/status/{data.confirmation_id}</code>.
      </p>
    </LegalPage>
  );
}
