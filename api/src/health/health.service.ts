import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/typeorm';
import { Connection } from 'typeorm';

@Injectable()
export class HealthService {
  private startTime: number;

  constructor(
    @InjectConnection()
    private connection: Connection,
  ) {
    this.startTime = Date.now();
  }

  async check() {
    try {
      const startQuery = Date.now();
      await this.connection.query('SELECT 1');
      const dbLatency = Date.now() - startQuery;

      return {
        status: 'ok',
        version: process.env.npm_package_version || '1.0.0',
        uptime: Math.floor((Date.now() - this.startTime) / 1000),
        timestamp: new Date().toISOString(),
        database: {
          status: 'connected',
          latency: dbLatency,
        },
      };
    } catch (error) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const err = error as any;
      return {
        status: 'error',
        message: err.message,
        timestamp: new Date().toISOString(),
      };
    }
  }
}
