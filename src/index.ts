import { fetchISSPosition } from './iss-api';
import { upsertLOCRecord } from './cloudflare-api';

export async function scheduled(
  controller: ScheduledEvent,
  env: Env,
  ctx: ExecutionContext
): Promise<void> {
  // Validate required environment variables
  if (!env.ZONE_ID) {
    console.error('Missing required environment variable: ZONE_ID');
    return;
  }
  if (!env.RECORD_NAME) {
    console.error('Missing required environment variable: RECORD_NAME');
    return;
  }
  if (!env.CLOUDFLARE_DNS_API_TOKEN) {
    console.error('Missing required environment variable: CLOUDFLARE_DNS_API_TOKEN');
    return;
  }

  try {
    const position = await fetchISSPosition();
    console.log('ISS Position:', position);

    const { id, created } = await upsertLOCRecord(
      env.ZONE_ID,
      env.RECORD_NAME,
      position,
      env.CLOUDFLARE_DNS_API_TOKEN
    );

    console.log(created ? 'Created new LOC record:' : 'Updated existing LOC record:', id);
  } catch (error) {
    console.error('Failed to update ISS LOC record:', error);
  }
}

export default {
  scheduled,
};
