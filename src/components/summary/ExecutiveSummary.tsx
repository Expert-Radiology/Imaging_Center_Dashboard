import type { DashboardPayload } from '../../../shared/types';
import { layout } from '../../styles/tokens';
import { heldConnections, inFlightOrder, unscheduledConnections } from '../../lib/derive';
import { BlockersByOwner } from './BlockersByOwner';
import { Decisions } from './Decisions';
import { KpiTrio, ParkedCard, StatusScaleCard, TeamCard } from './LeftColumn';
import { MilestoneMatrix } from './MilestoneMatrix';
import { Throughput } from './Throughput';

export function ExecutiveSummary({ payload }: { payload: DashboardPayload }) {
  const inFlight = inFlightOrder(payload);
  const held = heldConnections(payload);

  const unscheduled = unscheduledConnections(payload).map(shortName);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: layout.sectionGap }}>
      <div style={{ display: 'grid', gridTemplateColumns: '372px 1fr', gap: 26, alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: layout.cardGap }}>
          <TeamCard team={payload.team} />
          <StatusScaleCard overall={payload.overallStatus} lastWeek={payload.lastWeekStatus} />
          <KpiTrio totals={payload.totals} />
          <ParkedCard names={held.map((c) => c.centerName)} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: layout.cardGap }}>
          <MilestoneMatrix connections={inFlight} />
          <BlockersByOwner blockers={payload.blockers} coverage={payload.fieldCoverage} />
        </div>
      </div>

      <Throughput
        weeks={payload.throughput}
        unscheduled={unscheduled}
        inFlightCount={payload.totals.inFlight}
      />

      <Decisions decisions={payload.decisions} />
    </div>
  );
}

/** The throughput row uses short names; match the design's wording. */
function shortName(connection: { centerName: string }): string {
  return connection.centerName
    .replace(/^Professional Radiology of Oregon$/, 'Prof. Radiology of Oregon')
    .replace(/^Kansas City Advanced Imaging$/, 'Kansas City')
    .replace(/^Remington Molecular$/, 'Remington')
    .replace(/^Chenal MRI$/, 'Chenal');
}
