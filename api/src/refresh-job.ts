import { ClickUpClient } from './clickup/client';
import { buildPayload } from './buildPayload';
import { getClickUpToken } from './config';
import { writeDashboardBlob } from './storage/blob';
import { ensureTable, getSnapshot, listSnapshots, toSnapshot, writeSnapshotIfNew } from './storage/snapshots';
import { addWeeks, hqToday, weekStartFor } from './time';

/**
 * The hourly refresh, run as a Container Apps job on a cron schedule.
 *
 * It is a separate job rather than a timer inside the web container because the
 * web app scales to zero — an in-process timer would stop the moment the last
 * replica shut down, which is most of the day.
 *
 * The browser never calls ClickUp itself: the token must not ship to the client,
 * and one request per viewer per poll would burn the rate limit with a wall
 * display and three laptops open.
 */
async function main(): Promise<void> {
  const started = Date.now();
  const token = await getClickUpToken();
  const listId = process.env.CLICKUP_LIST_ID ?? '901316440634';

  if (!token) {
    // Not fatal: the site keeps serving its last payload, or the client's
    // bundled snapshot, clearly labelled as such.
    console.warn('No ClickUp token configured — nothing to refresh.');
    process.exit(0);
  }

  const now = new Date();
  const weekStart = weekStartFor(hqToday(now));

  await ensureTable().catch((error) => {
    console.warn(`Snapshot table unavailable: ${(error as Error).message}`);
  });

  const [previousSnapshot, history] = await Promise.all([
    getSnapshot(addWeeks(weekStart, -1)).catch(() => null),
    listSnapshots(addWeeks(weekStart, -8)).catch(() => []),
  ]);

  const payload = await buildPayload(new ClickUpClient(token), {
    listId,
    now,
    previousSnapshot,
    history,
  });

  await writeDashboardBlob(payload);

  // One snapshot per week — the first successful run of a new week writes it.
  // Without these there is no "last week" status, no new-this-week count and no
  // planned-vs-actual row.
  const wrote = await writeSnapshotIfNew(toSnapshot(payload)).catch((error) => {
    console.warn(`Snapshot write failed: ${(error as Error).message}`);
    return false;
  });

  for (const warning of payload.warnings) console.warn(`Data warning: ${warning}`);

  console.log(
    `Refreshed ${payload.connections.length} open connections in ${Date.now() - started}ms · ` +
      `snapshot ${wrote ? 'written' : 'already present'} · ` +
      `Pending Contact? missing on ${payload.fieldCoverage.pendingContactMissing}/${payload.fieldCoverage.inFlightCount}`,
  );
}

main().catch((error) => {
  // Failing loudly leaves the previous blob in place. The dashboard keeps
  // showing it with its real timestamp and says the refresh failed, rather than
  // presenting stale data as fresh.
  console.error(`Refresh failed: ${(error as Error).stack ?? (error as Error).message}`);
  process.exit(1);
});
