import { useMemo, useState } from 'react';
import { Stack } from '@mui/material';
import { PageContainer, PageHeader } from 'src/components/common/PageHeader';
import { SegControl } from 'src/components/common/SegControl';
import { QueryBoundary } from 'src/components/common/QueryBoundary';
import { useClientVolume, useDeliveryVolume, useOperationsReport } from 'src/hooks/useReports';
import {
  PERIOD_LABEL, PERIOD_OPTIONS, TAB_OPTIONS, apiGranularity, periodRange,
  type ReportPeriod, type ReportTab, type VolumeGranularity,
} from './reportModel';
import { VolumeTab } from './VolumeTab';
import { ClientsTab } from './ClientsTab';
import { OperationalTab } from './OperationalTab';

/**
 * Reporty — one page, three tabs, a shared period preset.
 *
 * Only the active tab's query runs; the other two are held disabled so switching tabs is
 * the only thing that fetches. The tabs themselves take loaded data as a plain prop and
 * never call a hook on possibly-missing data, which is why they could be built and tested
 * before this shell existed.
 */
export function ReportsPage() {
  const [tab, setTab] = useState<ReportTab>('volume');
  const [period, setPeriod] = useState<ReportPeriod>('90');
  const [granularity, setGranularity] = useState<VolumeGranularity>('week');

  const { from, to } = useMemo(() => periodRange(period), [period]);

  const volume = useDeliveryVolume(from, to, apiGranularity(granularity), tab === 'volume');
  const clients = useClientVolume(from, to, tab === 'clients');
  const operations = useOperationsReport(from, to, tab === 'operational');

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Analýza"
        title="Reporty"
        subtitle={`Dokončené vývozy · ${PERIOD_LABEL[period]}.`}
      />

      <Stack direction="row" alignItems="center" spacing={1.5} flexWrap="wrap" useFlexGap sx={{ mb: 2 }}>
        <SegControl value={tab} onChange={setTab} options={TAB_OPTIONS} />
        <SegControl value={period} onChange={setPeriod} options={PERIOD_OPTIONS} />
      </Stack>

      {tab === 'volume' && (
        <QueryBoundary query={volume}>
          {(data) => (
            <VolumeTab data={data} granularity={granularity} onGranularityChange={setGranularity} />
          )}
        </QueryBoundary>
      )}

      {tab === 'clients' && (
        <QueryBoundary query={clients}>{(data) => <ClientsTab data={data} />}</QueryBoundary>
      )}

      {tab === 'operational' && (
        <QueryBoundary query={operations}>{(data) => <OperationalTab data={data} />}</QueryBoundary>
      )}
    </PageContainer>
  );
}
