import type { ISSPosition } from './iss-api';

interface DNSRecord {
  id: string;
  type: string;
  name: string;
  content: string;
  ttl: number;
}

interface CloudflareAPIResponse<T> {
  success: boolean;
  errors: Array<{ code: number; message: string }>;
  messages: string[];
  result: T;
}

const CLOUDFLARE_API_BASE = 'https://api.cloudflare.com/client/v4';
const DNS_TTL = 120; // 2 minutes (2× the 1-minute update interval)

function convertToLOC(position: ISSPosition) {
  const { latitude, longitude, altitude } = position;

  const latAbs = Math.abs(latitude);
  const latDegrees = Math.floor(latAbs);
  const latMinutesDecimal = (latAbs - latDegrees) * 60;
  const latMinutes = Math.floor(latMinutesDecimal);
  const latSeconds = (latMinutesDecimal - latMinutes) * 60;
  const latDirection = latitude >= 0 ? 'N' : 'S';

  const lonAbs = Math.abs(longitude);
  const lonDegrees = Math.floor(lonAbs);
  const lonMinutesDecimal = (lonAbs - lonDegrees) * 60;
  const lonMinutes = Math.floor(lonMinutesDecimal);
  const lonSeconds = (lonMinutesDecimal - lonMinutes) * 60;
  const lonDirection = longitude >= 0 ? 'E' : 'W';

  const altitudeMeters = Math.round(altitude * 1000);

  return {
    lat_degrees: latDegrees,
    lat_minutes: latMinutes,
    lat_seconds: Math.round(latSeconds),
    lat_direction: latDirection as 'N' | 'S',
    long_degrees: lonDegrees,
    long_minutes: lonMinutes,
    long_seconds: Math.round(lonSeconds),
    long_direction: lonDirection as 'E' | 'W',
    altitude: altitudeMeters,
		size: 100,
    precision_horz: 10000,
    precision_vert: 10,
  };
}

async function handleCloudflareResponse<T>(response: Response, operation: string): Promise<T> {
  if (!response.ok) {
    throw new Error(`Failed to ${operation} DNS ${operation === 'list' ? 'records' : 'record'}: ${response.status} ${response.statusText}`);
  }

  const data = await response.json<CloudflareAPIResponse<T>>();

  if (!data.success && data.errors.length > 0) {
    throw new Error(`Cloudflare API error: ${data.errors[0].message}`);
  }

  return data.result;
}

export async function findLOCRecord(
  zoneId: string,
  recordName: string,
  apiToken: string
): Promise<DNSRecord | null> {
  const url = `${CLOUDFLARE_API_BASE}/zones/${zoneId}/dns_records?type=LOC&name=${recordName}`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${apiToken}`,
      'Content-Type': 'application/json',
    },
  });

  const records = await handleCloudflareResponse<DNSRecord[]>(response, 'list');
  return records?.[0] ?? null;
}

export async function upsertLOCRecord(
  zoneId: string,
  recordName: string,
  position: ISSPosition,
  apiToken: string
): Promise<{ id: string; created: boolean }> {
  const data = convertToLOC(position);
  const existingRecord = await findLOCRecord(zoneId, recordName, apiToken);

	const headers = {
		Authorization: `Bearer ${apiToken}`,
		'Content-Type': 'application/json',
	};

  if (existingRecord) {
    const url = `${CLOUDFLARE_API_BASE}/zones/${zoneId}/dns_records/${existingRecord.id}`;
    const response = await fetch(url, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ data }),
    });
    await handleCloudflareResponse<DNSRecord>(response, 'update');
    return { id: existingRecord.id, created: false };
  } else {
    const url = `${CLOUDFLARE_API_BASE}/zones/${zoneId}/dns_records`;
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        type: 'LOC',
        name: recordName,
        data,
        ttl: DNS_TTL,
      }),
    });
    const record = await handleCloudflareResponse<DNSRecord>(response, 'create');
    return { id: record.id, created: true };
  }
}
