import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Service for retrieving changelogs from various sources.
 *
 * Provides changelog retrieval with fallback strategy:
 * 1. Docker image label (offline capable)
 * 2. flowly-core API (online)
 * 3. null if neither available
 */
@Injectable()
export class ChangelogService {
  private readonly logger = new Logger(ChangelogService.name);
  private readonly coreUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.coreUrl =
      this.configService.get<string>('LICENSE_CORE_URL') || 'https://secure.flowlyweb.com';
  }

  /**
   * Retrieves changelog from Docker image label.
   *
   * Images built by the CI include the changelog in a base64-encoded label.
   * This allows offline changelog retrieval.
   *
   * @param imageName - Full Docker image name with tag
   * @returns Decoded changelog markdown or null
   */
  async getChangelogFromImage(imageName: string): Promise<string | null> {
    try {
      // Use docker inspect command to get labels
      const { stdout } = await execAsync(
        `docker inspect --format='{{index .Config.Labels "com.flowly.changelog"}}' ${imageName}`,
      );

      const changelogB64 = stdout.trim();
      if (!changelogB64 || changelogB64 === '<no value>') {
        this.logger.debug(`No changelog label found in image: ${imageName}`);
        return null;
      }

      // Decode base64 changelog
      const changelog = Buffer.from(changelogB64, 'base64').toString('utf-8');
      this.logger.debug(`Changelog retrieved from image label (${changelog.length} chars)`);

      return changelog;
    } catch (error) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.logger.warn(`Failed to get changelog from Docker image: ${(error as any).message}`);
      return null;
    }
  }

  /**
   * Retrieves changelog from flowly-core API.
   *
   * Requires network connectivity to flowly-core.
   *
   * @param version - Version string to get changelog for
   * @returns Changelog markdown or null
   */
  async getChangelogFromApi(version: string): Promise<string | null> {
    try {
      const response = await axios.get<{ changelog?: string }>(
        `${this.coreUrl}/api/updates/version/${version}`,
        { timeout: 10000 },
      );

      return response.data?.changelog || null;
    } catch (error) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.logger.warn(`Failed to get changelog from API: ${(error as any).message}`);
      return null;
    }
  }

  /**
   * Retrieves changelog with fallback strategy.
   *
   * Tries Docker label first (offline), then falls back to API.
   *
   * @param version - Version string
   * @param imageName - Optional specific image name (defaults to flowly-api)
   * @returns Changelog markdown or null
   */
  async getChangelog(version: string, imageName?: string): Promise<string | null> {
    // Build image name if not provided
    const registry = this.configService.get<string>(
      'DOCKER_REGISTRY',
      'registry.example.com/flowlyweb',
    );
    const fullImageName = imageName || `${registry}/flowly-api/api:onpremise-${version}`;

    // Try offline first (Docker label)
    const offlineChangelog = await this.getChangelogFromImage(fullImageName);
    if (offlineChangelog) {
      return offlineChangelog;
    }

    // Fallback to API
    this.logger.debug('Falling back to API for changelog');
    return this.getChangelogFromApi(version);
  }

  /**
   * Retrieves changelog for the currently installed version.
   *
   * @returns Current version changelog or null
   */
  async getCurrentChangelog(): Promise<string | null> {
    const currentVersion = this.configService.get<string>('APP_VERSION', '1.0.0');
    return this.getChangelog(currentVersion);
  }
}
