import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { ActiveServer } from './entities/active-server.entity';
import { Cron } from '@nestjs/schedule';
import { InstitutionsService } from '../institutions/institutions.service';

/**
 * Service for managing active BigBlueButton servers
 *
 * Tracks server heartbeats to monitor which servers are currently active
 * for each institution. In on-premise mode, unlimited servers are allowed.
 * In SaaS mode, quota enforcement is handled by flowly-core.
 */
@Injectable()
export class ServersService {
  private readonly logger = new Logger(ServersService.name);

  constructor(
    @InjectRepository(ActiveServer)
    private activeServerRepository: Repository<ActiveServer>,
    private institutionsService: InstitutionsService,
  ) {}

  /**
   * Processes a heartbeat from a BigBlueButton server
   *
   * @param institutionId - Institution ID
   * @param serverId - Unique server identifier
   * @param meetingId - BigBlueButton meeting ID
   * @param userId - User ID who triggered the heartbeat
   * @returns true if heartbeat was processed successfully
   */
  async processHeartbeat(
    institutionId: string,
    serverId: string,
    meetingId: string,
    userId: string,
  ): Promise<boolean> {
    try {
      const institution = await this.institutionsService.findById(institutionId);
      if (!institution) {
        throw new NotFoundException('Institution not found');
      }

      // Find or create server entry
      const server = await this.activeServerRepository.findOne({
        where: {
          institution: { id: institutionId },
          serverId,
        },
      });

      if (server) {
        // Update existing server
        server.lastHeartbeat = new Date();
        server.meetingId = meetingId;
        server.lastUserId = userId;
        server.isActive = true;
        await this.activeServerRepository.save(server);
      } else {
        // Create new server entry
        const newServer = this.activeServerRepository.create({
          serverId,
          meetingId,
          lastUserId: userId,
          lastHeartbeat: new Date(),
          isActive: true,
          institution,
        });
        await this.activeServerRepository.save(newServer);
      }

      return true;
    } catch (error) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const err = error as any;
      this.logger.error(`Error processing heartbeat: ${err.message}`, err.stack);
      return false;
    }
  }

  /**
   * Resets all servers for a given institution (marks as inactive)
   *
   * @param institutionId - Institution ID
   * @returns Result with count of affected servers
   */
  async resetServers(institutionId: string): Promise<{
    success: boolean;
    count?: number;
    message?: string;
  }> {
    try {
      const result = await this.activeServerRepository.update(
        { institution: { id: institutionId } },
        { isActive: false },
      );

      return {
        success: true,
        count: result.affected,
        message: `Successfully reset ${result.affected} server(s)`,
      };
    } catch (error) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const err = error as any;
      this.logger.error(`Error resetting servers: ${err.message}`, err.stack);
      return {
        success: false,
        message: 'Error while resetting servers',
      };
    }
  }

  /**
   * Scheduled task that runs every 15 minutes to mark inactive servers
   * Servers that haven't sent a heartbeat in 30 minutes are marked inactive
   */
  @Cron('0 */15 * * * *')
  async markInactiveServers() {
    const thresholdTime = new Date();
    thresholdTime.setMinutes(thresholdTime.getMinutes() - 30); // 30 minutes threshold

    try {
      const result = await this.activeServerRepository.update(
        {
          lastHeartbeat: LessThan(thresholdTime),
          isActive: true,
        },
        { isActive: false },
      );

      this.logger.log(`Marked ${result.affected} server(s) as inactive`);
    } catch (error) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const err = error as any;
      this.logger.error(`Error marking inactive servers: ${err.message}`, err.stack);
    }
  }

  /**
   * Retrieves list of active servers for an institution
   *
   * @param institutionId - Institution ID
   * @returns Array of active servers ordered by last heartbeat
   */
  async getActiveServers(institutionId: string) {
    return this.activeServerRepository.find({
      where: {
        institution: { id: institutionId },
        isActive: true,
      },
      relations: ['institution'],
      order: {
        lastHeartbeat: 'DESC',
      },
    });
  }

  /**
   * Gets the count of active servers for an institution
   *
   * @param institutionId - Institution ID
   * @returns Number of active servers
   */
  async getActiveServersCount(institutionId: string): Promise<number> {
    return this.activeServerRepository.count({
      where: {
        institution: { id: institutionId },
        isActive: true,
      },
    });
  }

  /**
   * Checks the server quota for an institution
   *
   * @param institutionId - Institution ID
   * @returns Quota information (max servers, current count, unlimited flag)
   */
  async checkQuota(institutionId: string): Promise<{
    maxServers: number | null;
    currentCount: number;
    isUnlimited: boolean;
  }> {
    const institution = await this.institutionsService.findById(institutionId);

    if (!institution) {
      throw new NotFoundException('Institution not found');
    }

    // Get current active servers count
    const currentCount = await this.getActiveServersCount(institutionId);

    // Check if unlimited servers (on-premise or enterprise license)
    const licenseLimits = institution.licenseCachedData?.limits;
    const maxServers = licenseLimits?.maxServers ?? null;
    const isUnlimited = maxServers === null || maxServers === -1;

    return {
      maxServers: isUnlimited ? null : maxServers,
      currentCount,
      isUnlimited,
    };
  }
}
