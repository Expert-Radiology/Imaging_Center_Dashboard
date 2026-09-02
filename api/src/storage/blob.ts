import { DefaultAzureCredential } from '@azure/identity';
import { BlobServiceClient, RestError } from '@azure/storage-blob';
import type { DashboardPayload } from '../../../shared/types';

const BLOB_NAME = 'dashboard.json';

function container() {
  const account = process.env.DASHBOARD_STORAGE_ACCOUNT;
  const containerName = process.env.DASHBOARD_BLOB_CONTAINER ?? 'dashboard';
  if (!account) throw new Error('DASHBOARD_STORAGE_ACCOUNT is not set');

  // Managed identity in Azure, developer credentials locally. No connection
  // string and no account key ever lands in app settings.
  const service = new BlobServiceClient(
    `https://${account}.blob.core.windows.net`,
    new DefaultAzureCredential(),
  );
  return service.getContainerClient(containerName);
}

export async function writeDashboardBlob(payload: DashboardPayload): Promise<void> {
  const client = container().getBlockBlobClient(BLOB_NAME);
  const body = JSON.stringify(payload);
  await client.upload(body, Buffer.byteLength(body), {
    blobHTTPHeaders: {
      blobContentType: 'application/json; charset=utf-8',
      blobCacheControl: 'no-cache',
    },
  });
}

export async function readDashboardBlob(): Promise<DashboardPayload | null> {
  try {
    const client = container().getBlockBlobClient(BLOB_NAME);
    const download = await client.download();
    const body = await streamToString(download.readableStreamBody);
    return JSON.parse(body) as DashboardPayload;
  } catch (error) {
    if (error instanceof RestError && error.statusCode === 404) return null;
    throw error;
  }
}

async function streamToString(stream: NodeJS.ReadableStream | undefined): Promise<string> {
  if (!stream) return '';
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf8');
}
