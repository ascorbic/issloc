import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchISSPosition } from '../src/iss-api';

describe('fetchISSPosition', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should fetch and return ISS position successfully', async () => {
    const mockResponse = {
      name: 'iss',
      id: 25544,
      latitude: 33.070531,
      longitude: -124.767058,
      altitude: 419.493,
      velocity: 27593.521,
      visibility: 'eclipsed',
      footprint: 4504.888,
      timestamp: 1764498770,
      daynum: 2461009.939,
      solar_lat: -21.715,
      solar_lon: 18.969,
      units: 'kilometers',
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    });

    const result = await fetchISSPosition();

    expect(result).toEqual({
      latitude: 33.070531,
      longitude: -124.767058,
      altitude: 419.493,
    });

    expect(fetch).toHaveBeenCalledWith('https://api.wheretheiss.at/v1/satellites/25544');
  });

  it('should throw error when fetch fails', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    });

    await expect(fetchISSPosition()).rejects.toThrow('Failed to fetch ISS position: 500 Internal Server Error');
  });

  it('should throw error when network request fails', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

    await expect(fetchISSPosition()).rejects.toThrow('Network error');
  });

  it('should validate response has required fields', async () => {
    const mockResponse = {
      name: 'iss',
      id: 25544,
      // Missing latitude, longitude, altitude
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    });

    await expect(fetchISSPosition()).rejects.toThrow('Invalid ISS API response');
  });

  it('should validate latitude is a number', async () => {
    const mockResponse = {
      name: 'iss',
      id: 25544,
      latitude: 'invalid',
      longitude: -124.767058,
      altitude: 419.493,
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    });

    await expect(fetchISSPosition()).rejects.toThrow('Invalid ISS API response');
  });

  it('should validate longitude is a number', async () => {
    const mockResponse = {
      name: 'iss',
      id: 25544,
      latitude: 33.070531,
      longitude: null,
      altitude: 419.493,
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    });

    await expect(fetchISSPosition()).rejects.toThrow('Invalid ISS API response');
  });

  it('should validate altitude is a number', async () => {
    const mockResponse = {
      name: 'iss',
      id: 25544,
      latitude: 33.070531,
      longitude: -124.767058,
      altitude: undefined,
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    });

    await expect(fetchISSPosition()).rejects.toThrow('Invalid ISS API response');
  });
});
