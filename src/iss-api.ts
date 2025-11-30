export interface ISSPosition {
  latitude: number;
  longitude: number;
  altitude: number;
}

const ISS_API_URL = 'https://api.wheretheiss.at/v1/satellites/25544';

function isValidISSResponse(data: unknown): data is ISSPosition {
  if (!data || typeof data !== 'object') {
    return false;
  }

  const response = data as Partial<ISSPosition>;

  return (
    typeof response.latitude === 'number' &&
    typeof response.longitude === 'number' &&
    typeof response.altitude === 'number'
  );
}

export async function fetchISSPosition(): Promise<ISSPosition> {
  const response = await fetch(ISS_API_URL);

  if (!response.ok) {
    throw new Error(`Failed to fetch ISS position: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();

  if (!isValidISSResponse(data)) {
    throw new Error('Invalid ISS API response');
  }

  return {
    latitude: data.latitude,
    longitude: data.longitude,
    altitude: data.altitude,
  };
}
