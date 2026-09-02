export interface ClickUpCustomField {
  id: string;
  name: string;
  type: string;
  type_config?: {
    options?: Array<{ id: string; name?: string; label?: string; orderindex?: number }>;
  };
  value?: unknown;
}

export interface ClickUpTask {
  id: string;
  name: string;
  status?: { status?: string; type?: string };
  date_created?: string;
  date_updated?: string;
  date_closed?: string | null;
  url?: string;
  assignees?: Array<{ id: number; username?: string; email?: string }>;
  tags?: Array<{ name: string }>;
  parent?: string | null;
  custom_fields?: ClickUpCustomField[];
  subtasks?: ClickUpTask[];
  priority?: { priority?: string } | null;
}

interface ListTasksResponse {
  tasks: ClickUpTask[];
  last_page?: boolean;
}

const BASE = 'https://api.clickup.com/api/v2';

/**
 * ClickUp allows 100 requests/minute on the plan in use. A refresh costs one
 * list call plus one detail call per open center — about 29 today — so the
 * limiter exists to keep a growing pipeline from tripping it, not because the
 * current volume is close.
 */
class RateLimiter {
  private timestamps: number[] = [];

  constructor(
    private readonly limit = 90,
    private readonly windowMs = 60_000,
  ) {}

  async acquire(): Promise<void> {
    for (;;) {
      const now = Date.now();
      this.timestamps = this.timestamps.filter((t) => now - t < this.windowMs);
      if (this.timestamps.length < this.limit) {
        this.timestamps.push(now);
        return;
      }
      const oldest = this.timestamps[0];
      await sleep(this.windowMs - (now - oldest) + 50);
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class ClickUpClient {
  private readonly limiter = new RateLimiter();

  constructor(
    private readonly token: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {
    if (!token) throw new Error('CLICKUP_TOKEN is not set');
  }

  private async request<T>(path: string): Promise<T> {
    await this.limiter.acquire();

    // One retry on 429/5xx, honouring Retry-After. Beyond that the refresh
    // fails loudly and the served blob keeps its old timestamp.
    for (let attempt = 0; attempt < 2; attempt++) {
      const response = await this.fetchImpl(`${BASE}${path}`, {
        headers: { Authorization: this.token, accept: 'application/json' },
      });

      if (response.ok) return (await response.json()) as T;

      const retryable = response.status === 429 || response.status >= 500;
      if (!retryable || attempt === 1) {
        throw new Error(`ClickUp ${response.status} on ${path}`);
      }

      const retryAfter = Number(response.headers.get('retry-after') ?? '5');
      await sleep(Math.min(Math.max(retryAfter, 1), 30) * 1000);
    }

    throw new Error(`ClickUp request failed: ${path}`);
  }

  /**
   * Open center tasks. Paginated on purpose: the endpoint caps at 100 per page
   * and a single naive call silently truncates as the pipeline grows.
   */
  async listOpenCenters(listId: string): Promise<ClickUpTask[]> {
    const tasks: ClickUpTask[] = [];

    for (let page = 0; page < 50; page++) {
      const response = await this.request<ListTasksResponse>(
        `/list/${listId}/task?subtasks=false&include_closed=false&page=${page}`,
      );
      tasks.push(...response.tasks);

      // ClickUp signals the end with last_page, and returns a short page too.
      if (response.last_page || response.tasks.length === 0) break;
    }

    return tasks;
  }

  /** One center with its subtasks — the milestone source. */
  async getTaskWithSubtasks(taskId: string): Promise<ClickUpTask> {
    return this.request<ClickUpTask>(`/task/${taskId}?include_subtasks=true`);
  }

  async listCustomFields(listId: string): Promise<ClickUpCustomField[]> {
    const response = await this.request<{ fields: ClickUpCustomField[] }>(
      `/list/${listId}/field`,
    );
    return response.fields ?? [];
  }

  /** Total task count on the list, for the footer's "107 centers" line. */
  async countAllCenters(listId: string): Promise<number> {
    let total = 0;
    for (let page = 0; page < 50; page++) {
      const response = await this.request<ListTasksResponse>(
        `/list/${listId}/task?subtasks=false&include_closed=true&page=${page}`,
      );
      total += response.tasks.length;
      if (response.last_page || response.tasks.length === 0) break;
    }
    return total;
  }
}

/** Run `tasks` through `worker` with bounded concurrency. */
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;

  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) {
      const index = cursor++;
      if (index >= items.length) return;
      results[index] = await worker(items[index]);
    }
  });

  await Promise.all(runners);
  return results;
}
