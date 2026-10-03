'use client';

import { useRouter } from 'next/navigation';
import { TargetForm } from '@/components/target-form';
import { PageHeader } from '@/components/ui';
import { api } from '@/lib/api';
import type { Target } from '@/lib/types';

export default function NewTargetPage() {
  const router = useRouter();
  return (
    <>
      <PageHeader title="Add target" crumbs={[{ href: '/targets', label: 'Targets' }]} subtitle="Register an application you own or have explicit permission to test." />
      <div className="panel max-w-2xl p-6">
        <TargetForm
          submitLabel="Save target"
          onSubmit={async (v) => {
            const t = await api<Target>('/targets', {
              method: 'POST',
              body: {
                name: v.name,
                description: v.description || undefined,
                baseUrl: v.baseUrl,
                environment: v.environment,
                authorizationConfirmed: v.authorizationConfirmed,
                authorizationNote: v.authorizationNote || undefined,
              },
            });
            router.push(`/targets/${t.id}`);
          }}
        />
      </div>
    </>
  );
}
