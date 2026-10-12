import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { HealthService } from './health.service';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Public()
  @Get()
  @ApiOperation({
    summary: 'Check API health status',
    description: `
      Checks the overall health of the API and its dependencies.
      
      This endpoint verifies:
      - API availability
      - Database connection
      - Required services status
      
      Use this endpoint for:
      - Monitoring systems
      - Load balancers
      - Kubernetes liveness probes
      - General health checks
    `,
  })
  @ApiResponse({
    status: 200,
    description: 'API is healthy and all services are operational',
    schema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          example: 'ok',
          description: 'Overall health status',
        },
        version: {
          type: 'string',
          example: '1.0.0',
          description: 'API version',
        },
        uptime: {
          type: 'number',
          example: 12345,
          description: 'API uptime in seconds',
        },
        timestamp: {
          type: 'string',
          example: '2025-01-26T13:45:00.000Z',
          description: 'Current server timestamp',
        },
        database: {
          type: 'object',
          properties: {
            status: { type: 'string', example: 'connected' },
            latency: { type: 'number', example: 5 },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 503,
    description: 'Service is unavailable or some components are unhealthy',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'error' },
        message: { type: 'string', example: 'Database connection failed' },
        timestamp: { type: 'string', example: '2025-01-26T13:45:00.000Z' },
      },
    },
  })
  async checkHealth() {
    return this.healthService.check();
  }
}
