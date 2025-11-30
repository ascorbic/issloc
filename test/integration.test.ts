import { describe, it, expect, beforeEach, vi } from 'vitest';
import { env, fetchMock, createScheduledController, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import worker from '../src/index';

declare module 'cloudflare:test' {
  interface ProvidedEnv extends Env {}
}

describe('Worker Integration', () => {
  const ZONE_ID = 'xoxoxo';
  const RECORD_NAME = 'iss.example.com';

  beforeEach(() => {
    fetchMock.deactivate();
    fetchMock.activate();
    fetchMock.disableNetConnect();

    env.ZONE_ID = ZONE_ID;
    env.RECORD_NAME = RECORD_NAME;
    env.CLOUDFLARE_DNS_API_TOKEN = 'test-api-token';
  });

  it('should update LOC record with current ISS position when record exists', async () => {
    const mockISSResponse = {
      latitude: 33.070531,
      longitude: -124.767058,
      altitude: 419.493,
    };

    const mockExistingRecord = {
      id: 'record-123',
      type: 'LOC',
      name: RECORD_NAME,
    };

    const mockUpdatedRecord = {
      id: 'record-123',
      type: 'LOC',
      name: RECORD_NAME,
    };

    fetchMock
      .get('https://api.wheretheiss.at')
      .intercept({ path: '/v1/satellites/25544' })
      .reply(200, JSON.stringify(mockISSResponse));

    fetchMock
      .get('https://api.cloudflare.com')
      .intercept({
        path: `/client/v4/zones/${ZONE_ID}/dns_records`,
        query: { name: RECORD_NAME, type: 'LOC' }
      })
      .reply(200, JSON.stringify({
        success: true,
        errors: [],
        messages: [],
        result: [mockExistingRecord],
      }));

    fetchMock
      .get('https://api.cloudflare.com')
      .intercept({
        path: `/client/v4/zones/${ZONE_ID}/dns_records/record-123`,
        method: 'PATCH'
      })
      .reply(200, JSON.stringify({
        success: true,
        errors: [],
        messages: [],
        result: mockUpdatedRecord,
      }));

    const consoleSpy = vi.spyOn(console, 'log');

    const ctrl = createScheduledController({
      scheduledTime: Date.now(),
      cron: '*/5 * * * *',
    });
    const ctx = createExecutionContext();
    await worker.scheduled(ctrl as any, env as any, ctx);
    await waitOnExecutionContext(ctx);

    expect(consoleSpy).toHaveBeenCalledWith(
      'ISS Position:',
      expect.objectContaining({
        latitude: 33.070531,
        longitude: -124.767058,
        altitude: 419.493,
      })
    );
    expect(consoleSpy).toHaveBeenCalledWith('Updated existing LOC record:', 'record-123');
  });

  it('should create new LOC record when record does not exist', async () => {
    const mockISSResponse = {
      latitude: 33.070531,
      longitude: -124.767058,
      altitude: 419.493,
    };

    const mockCreatedRecord = {
      id: 'record-new',
      type: 'LOC',
      name: RECORD_NAME,
    };

    fetchMock
      .get('https://api.wheretheiss.at')
      .intercept({ path: '/v1/satellites/25544' })
      .reply(200, JSON.stringify(mockISSResponse));

    fetchMock
      .get('https://api.cloudflare.com')
      .intercept({
        path: `/client/v4/zones/${ZONE_ID}/dns_records`,
        query: { name: RECORD_NAME, type: 'LOC' }
      })
      .reply(200, JSON.stringify({
        success: true,
        errors: [],
        messages: [],
        result: [],
      }));

    fetchMock
      .get('https://api.cloudflare.com')
      .intercept({
        path: `/client/v4/zones/${ZONE_ID}/dns_records`,
        method: 'POST'
      })
      .reply(200, JSON.stringify({
        success: true,
        errors: [],
        messages: [],
        result: mockCreatedRecord,
      }));

    const consoleSpy = vi.spyOn(console, 'log');

    const ctrl = createScheduledController({
      scheduledTime: Date.now(),
      cron: '*/5 * * * *',
    });
    const ctx = createExecutionContext();
    await worker.scheduled(ctrl as any, env as any, ctx);
    await waitOnExecutionContext(ctx);

    expect(consoleSpy).toHaveBeenCalledWith('Created new LOC record:', 'record-new');
  });

  it('should log error and not throw when ISS API fails', async () => {
    fetchMock
      .get('https://api.wheretheiss.at')
      .intercept({ path: '/v1/satellites/25544' })
      .reply(500, 'Internal Server Error');

    const consoleSpy = vi.spyOn(console, 'error');

    const ctrl = createScheduledController({
      scheduledTime: Date.now(),
      cron: '*/5 * * * *',
    });
    const ctx = createExecutionContext();
    await expect(worker.scheduled(ctrl as any, env as any, ctx)).resolves.not.toThrow();
    await waitOnExecutionContext(ctx);

    expect(consoleSpy).toHaveBeenCalledWith(
      'Failed to update ISS LOC record:',
      expect.any(Error)
    );
  });

  it('should log error and not throw when Cloudflare API fails', async () => {
    const mockISSResponse = {
      latitude: 33.070531,
      longitude: -124.767058,
      altitude: 419.493,
    };

    fetchMock
      .get('https://api.wheretheiss.at')
      .intercept({ path: '/v1/satellites/25544' })
      .reply(200, JSON.stringify(mockISSResponse));

    fetchMock
      .get('https://api.cloudflare.com')
      .intercept({
        path: `/client/v4/zones/${ZONE_ID}/dns_records`,
        query: { name: RECORD_NAME, type: 'LOC' }
      })
      .reply(401, 'Unauthorized');

    const consoleSpy = vi.spyOn(console, 'error');

    const ctrl = createScheduledController({
      scheduledTime: Date.now(),
      cron: '*/5 * * * *',
    });
    const ctx = createExecutionContext();
    await expect(worker.scheduled(ctrl as any, env as any, ctx)).resolves.not.toThrow();
    await waitOnExecutionContext(ctx);

    expect(consoleSpy).toHaveBeenCalledWith(
      'Failed to update ISS LOC record:',
      expect.any(Error)
    );
  });
});
