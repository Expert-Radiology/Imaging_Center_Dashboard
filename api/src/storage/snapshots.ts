import { DefaultAzureCredential } from '@azure/identity';
import { TableClient, odata } from '@azure/data-tables';
import type { Connection, DashboardPayload, WeeklySnapshot } from '../../../shared/types';

const PARTITION = 'weekly';

/**
 * Three things in the design cannot be computed from a live ClickUp read:
 * "Last week" status, "new centers entered pipeline this week", and the
 * "actually completed" throughput row. All three need a persisted Monday
 * snapshot, so this table is not optional.
 */
function table(): TableClient {
  const account = process.env.DASHBOARD_STORAGE_ACCOUNT;
  const tableName = process.env.DASHBOARD_SNAPSHOT_TABLE ?? 'weeklysnapshots';
  if (!account) throw new Error('DASHBOARD_STORAGE_ACCOUNT is not set');

  return new TableClient(
    `https://${account}.table.core.windows.net`,
    tableName,
    new DefaultAzureCredential(),
  );
}

interface SnapshotEntity {
  partitionKey: string;
  rowKey: string;
  capturedAt: string;
  overallStatus: string;
  /** JSON blobs — Table Storage caps a property at 64 KB, ample at this size. */
  openConnectionIds: string;
  perConnection: string;
}

export function toSnapshot(payload: DashboardPayload): WeeklySnapshot {
  return {
    weekStart: payload.week.start,
    capturedAt: payload.generatedAt,
    overallStatus: payload.overallStatus,
    openConnectionIds: payload.connections.map((c) => c.id),
    perConnection: payload.connections.map(summarize),
  };
}

function summarize(connection: Connection): WeeklySnapshot['perConnection'][number] {
  return {
    id: connection.id,
    centerName: connection.centerName,
    status: connection.status,
    percentComplete: connection.percentComplete,
    milestones: connection.milestones,
    finalFlag: connection.finalFlag,
  };
}

export async function ensureTable(): Promise<void> {
  await table().createTable();
}

/** Written once per week — the first successful refresh of a new week wins. */
export async function writeSnapshotIfNew(snapshot: WeeklySnapshot): Promise<boolean> {
  const client = table();
  try {
    await client.getEntity(PARTITION, snapshot.weekStart);
    return false;
  } catch {
    // Not found — fall through and write it.
  }

  const entity: SnapshotEntity = {
    partitionKey: PARTITION,
    rowKey: snapshot.weekStart,
    capturedAt: snapshot.capturedAt,
    overallStatus: snapshot.overallStatus,
    openConnectionIds: JSON.stringify(snapshot.openConnectionIds),
    perConnection: JSON.stringify(snapshot.perConnection),
  };

  await client.createEntity(entity);
  return true;
}

export async function listSnapshots(sinceWeekStart: string): Promise<WeeklySnapshot[]> {
  const client = table();
  const snapshots: WeeklySnapshot[] = [];

  const entities = client.listEntities<SnapshotEntity>({
    queryOptions: {
      filter: odata`PartitionKey eq ${PARTITION} and RowKey ge ${sinceWeekStart}`,
    },
  });

  for await (const entity of entities) {
    snapshots.push({
      weekStart: entity.rowKey,
      capturedAt: entity.capturedAt,
      overallStatus: entity.overallStatus as WeeklySnapshot['overallStatus'],
      openConnectionIds: safeParse(entity.openConnectionIds, []),
      perConnection: safeParse(entity.perConnection, []),
    });
  }

  return snapshots.sort((a, b) => a.weekStart.localeCompare(b.weekStart));
}

export async function getSnapshot(weekStart: string): Promise<WeeklySnapshot | null> {
  const [snapshot] = await listSnapshots(weekStart);
  return snapshot?.weekStart === weekStart ? snapshot : null;
}

function safeParse<T>(value: string | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}
