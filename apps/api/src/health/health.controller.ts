import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';

interface HealthResponse {
  readonly status: 'ok';
  readonly service: 'devleague-api';
}

interface ReadinessResponse extends HealthResponse {
  readonly dependencies: {
    readonly postgres: 'ready';
  };
}

@Controller('health')
export class HealthController {
  constructor(private readonly database: DatabaseService) {}

  @Get()
  getHealth(): HealthResponse {
    return {
      status: 'ok',
      service: 'devleague-api'
    };
  }

  @Get('ready')
  async getReadiness(): Promise<ReadinessResponse> {
    const databaseStatus = await this.database.checkReadiness();
    if (!databaseStatus.ready) {
      throw new ServiceUnavailableException({
        status: 'unavailable',
        service: 'devleague-api',
        dependency: 'postgres',
        reason: databaseStatus.reason
      });
    }

    return {
      status: 'ok',
      service: 'devleague-api',
      dependencies: { postgres: 'ready' }
    };
  }
}
