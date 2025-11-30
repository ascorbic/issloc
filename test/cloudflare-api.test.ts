import { describe, it, expect, vi, beforeEach } from 'vitest';
import { findLOCRecord } from '../src/cloudflare-api';

describe('Cloudflare API', () => {
  const mockApiToken = 'test-api-token';
  const mockZoneId = 'test-zone-id';
  const mockRecordName = 'iss.example.com';

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('findLOCRecord', () => {
    it('should find existing LOC record', async () => {
      const mockRecord = {
        id: 'record-123',
        type: 'LOC',
        name: mockRecordName,
        content: '33 4 14 N 124 46 1 W 419493m',
        ttl: 120,
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          errors: [],
          messages: [],
          result: [mockRecord],
        }),
      });

      const result = await findLOCRecord(mockZoneId, mockRecordName, mockApiToken);

      expect(result).toEqual(mockRecord);
      expect(fetch).toHaveBeenCalledWith(
        `https://api.cloudflare.com/client/v4/zones/${mockZoneId}/dns_records?type=LOC&name=${mockRecordName}`,
        {
          headers: {
            Authorization: `Bearer ${mockApiToken}`,
            'Content-Type': 'application/json',
          },
        }
      );
    });

    it('should return null when no LOC record exists', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          errors: [],
          messages: [],
          result: [],
        }),
      });

      const result = await findLOCRecord(mockZoneId, mockRecordName, mockApiToken);

      expect(result).toBeNull();
    });

    it('should throw error when API request fails', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      });

      await expect(findLOCRecord(mockZoneId, mockRecordName, mockApiToken)).rejects.toThrow(
        'Failed to list DNS records: 401 Unauthorized'
      );
    });

    it('should throw error when API returns errors', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: false,
          errors: [{ code: 1003, message: 'Invalid zone ID' }],
          messages: [],
          result: null,
        }),
      });

      await expect(findLOCRecord(mockZoneId, mockRecordName, mockApiToken)).rejects.toThrow(
        'Cloudflare API error: Invalid zone ID'
      );
    });
  });
});
