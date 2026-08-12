import { describe, expect, it } from 'vitest';
import { ServiceUnavailableException } from '@nestjs/common';
import { HealthController } from './health.controller.js';

function databaseStub(result: { ready: true } | { ready: false; reason: string }) {
  return {
    checkReadiness: () => Promise.resolve(result)
  };
}

describe('HealthController', () => {
  it('RF-OPS-001 exposes the API process health without claiming dependency readiness', () => {
    const controller = new HealthController(databaseStub({ ready: true }) as never);

    expect(controller.getHealth()).toEqual({
      status: 'ok',
      service: 'devleague-api'
    });
  });

  it('RNF-REL-004 reports readiness only after PostgreSQL answers', async () => {
    const controller = new HealthController(databaseStub({ ready: true }) as never);

    await expect(controller.getReadiness()).resolves.toEqual({
      status: 'ok',
      service: 'devleague-api',
      dependencies: { postgres: 'ready' }
    });
  });

  it('RNF-REL-004 returns unavailable when PostgreSQL is not configured', async () => {
    const controller = new HealthController(
      databaseStub({ ready: false, reason: 'configuration_missing' }) as never
    );

    await expect(controller.getReadiness()).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
