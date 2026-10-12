import {
  Controller,
  Post,
  Body,
  UseGuards,
  Request,
  Get,
  BadRequestException,
  NotFoundException,
  Headers,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ServersService } from './servers.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { HeartbeatDto } from './dto/heartbeat.dto';
import { Public } from '../common/decorators/public.decorator';
import { InstitutionsService } from '../institutions/institutions.service';

/**
 * Controller for managing active BigBlueButton servers
 *
 * Provides endpoints for:
 * - Server heartbeat tracking
 * - Listing active servers
 * - Resetting server status
 */
@ApiTags('Servers')
@Controller('servers')
export class ServersController {
  constructor(
    private readonly serversService: ServersService,
    private readonly institutionsService: InstitutionsService,
  ) {}

  @Public()
  @Post('heartbeat')
  @ApiOperation({
    summary: 'Process server heartbeat',
    description: `
    Registers a heartbeat from a BBB server.
    This endpoint should be called periodically (every 15 minutes) by the moderator
    of a BBB meeting to indicate that the server is still active.

    Servers that don't send heartbeats for 30 minutes are automatically marked as inactive.

    Authentication: Uses the origin header to identify the institution.
  `,
  })
  @ApiResponse({
    status: 200,
    description: 'Heartbeat processed successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Origin header missing',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 400 },
        message: { type: 'string', example: 'Origin header is required' },
        error: { type: 'string', example: 'Bad Request' },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Not Found - Institution not found for the provided origin',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 404 },
        message: { type: 'string', example: 'Institution not found for this domain' },
        error: { type: 'string', example: 'Not Found' },
      },
    },
  })
  async processHeartbeat(@Body() heartbeatDto: HeartbeatDto, @Headers('origin') origin: string) {
    // Verify origin header is present
    if (!origin) {
      throw new BadRequestException('Origin header is required');
    }

    // Find institution matching the origin
    const institution = await this.institutionsService.findByOrigin(origin);

    if (!institution) {
      throw new NotFoundException('Institution not found for this domain');
    }

    // Process the heartbeat
    const result = await this.serversService.processHeartbeat(
      institution.id,
      heartbeatDto.serverId,
      heartbeatDto.meetingId,
      heartbeatDto.userId,
    );

    return { success: result };
  }

  @Post('reset')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Reset active servers',
    description: `
      Marks all servers for the authenticated user's institution as inactive.
      This endpoint is typically used to manually reset
      the list of active servers when needed.
    `,
  })
  @ApiResponse({
    status: 200,
    description: 'Servers reset successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        count: { type: 'number', example: 3, description: 'Number of servers reset' },
        message: { type: 'string', example: 'Successfully reset 3 server(s)' },
      },
    },
  })
  async resetServers(@Request() req) {
    const institutionId = req.user.institutionId;
    return this.serversService.resetServers(institutionId);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Get active servers',
    description: "Returns a list of active servers for the authenticated user's institution",
  })
  @ApiResponse({
    status: 200,
    description: 'List of active servers',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'abc123' },
          serverId: { type: 'string', example: 'server01' },
          meetingId: { type: 'string', example: 'meeting123' },
          lastUserId: { type: 'string', example: 'user456' },
          isActive: { type: 'boolean', example: true },
          lastHeartbeat: { type: 'string', format: 'date-time' },
        },
      },
    },
  })
  async getActiveServers(@Request() req) {
    const institutionId = req.user.institutionId;
    return this.serversService.getActiveServers(institutionId);
  }

  @Public()
  @Post('check-quota')
  @ApiOperation({
    summary: 'Check server quota',
    description: `
      Returns quota information (max servers allowed, current count) for an institution.

      Authentication: Uses the origin header to identify the institution.
      This endpoint is public to allow the BBB plugin to check quotas without authentication.
    `,
  })
  @ApiResponse({
    status: 200,
    description: 'Quota information',
    schema: {
      type: 'object',
      properties: {
        maxServers: { type: 'number', example: 5, nullable: true },
        currentCount: { type: 'number', example: 2 },
        isUnlimited: { type: 'boolean', example: false },
        canActivate: { type: 'boolean', example: true },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Origin header missing',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 400 },
        message: { type: 'string', example: 'Origin header is required' },
        error: { type: 'string', example: 'Bad Request' },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Not Found - Institution not found for the provided origin',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 404 },
        message: { type: 'string', example: 'Institution not found for this domain' },
        error: { type: 'string', example: 'Not Found' },
      },
    },
  })
  async checkQuota(
    @Body() body: { serverId?: string; meetingId?: string },
    @Headers('origin') origin: string,
  ) {
    // Verify origin header is present
    if (!origin) {
      throw new BadRequestException('Origin header is required');
    }

    // Find institution matching the origin
    const institution = await this.institutionsService.findByOrigin(origin);

    if (!institution) {
      throw new NotFoundException('Institution not found for this domain');
    }

    // Get quota information
    const quotaInfo = await this.serversService.checkQuota(institution.id);

    // Calculate if plugin can activate
    const canActivate =
      quotaInfo.isUnlimited || quotaInfo.currentCount < (quotaInfo.maxServers ?? 0);

    return {
      ...quotaInfo,
      canActivate,
    };
  }
}
