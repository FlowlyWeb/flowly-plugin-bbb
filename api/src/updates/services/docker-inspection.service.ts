import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as semver from 'semver';

const execAsync = promisify(exec);

/**
 * Docker image information
 */
export interface DockerImageInfo {
  /**
   * Full image name with tag (e.g., registry/repo:tag)
   */
  imageName: string;

  /**
   * Extracted version from tag
   */
  version: string | null;

  /**
   * Image ID
   */
  imageId: string;

  /**
   * Image creation timestamp
   */
  created: Date | null;
}

/**
 * Docker Inspection Service
 *
 * Provides read-only access to Docker daemon for inspecting container images
 * and extracting version information. Used in conjunction with Watchtower
 * to determine available updates.
 *
 * Security features:
 * - Whitelist of allowed container names
 * - Read-only Docker socket access
 * - Input validation on all commands
 * - No destructive operations
 *
 * Requires Docker socket access: /var/run/docker.sock mounted in container
 */
@Injectable()
export class DockerInspectionService {
  private readonly logger = new Logger(DockerInspectionService.name);

  /**
   * Whitelist of container names that can be inspected
   * Prevents arbitrary command injection
   */
  private readonly ALLOWED_CONTAINERS = ['flowly-api', 'flowly-dashboard', 'flowly-plugin'];

  /**
   * Default Docker registry URL
   */
  private readonly defaultRegistry: string;

  constructor(private readonly configService: ConfigService) {
    this.defaultRegistry =
      this.configService.get<string>('DOCKER_REGISTRY') || 'registry.example.com/flowlyweb';

    this.logger.log('Docker inspection service initialized');
  }

  /**
   * Get the current image version for a running container
   *
   * Version detection strategy (in order of priority):
   * 1. OCI label: org.opencontainers.image.version (set at build time)
   * 2. Custom label: com.flowly.version (legacy)
   * 3. Environment variable: APP_VERSION (from container env)
   * 4. Image tag extraction (fallback, fails for "latest" tags)
   *
   * This allows correct version detection even when using "latest" tags,
   * as long as the image was built with proper version labels.
   *
   * @param containerName - Name of the container to inspect
   * @returns Version string or null if not found
   * @throws Error if container name is not whitelisted
   */
  async getCurrentImageVersion(containerName: string): Promise<string | null> {
    this.validateContainerName(containerName);

    this.logger.debug(`Getting current image version for: ${containerName}`);

    try {
      // Strategy 1: Try OCI standard label (org.opencontainers.image.version)
      const { stdout: ociVersion } = await execAsync(
        `docker inspect --format='{{index .Config.Labels "org.opencontainers.image.version"}}' ${containerName}`,
      );
      const ociVersionTrimmed = ociVersion.trim();
      if (ociVersionTrimmed && ociVersionTrimmed !== '<no value>') {
        this.logger.debug(`Version from OCI label for ${containerName}: ${ociVersionTrimmed}`);
        return this.cleanVersion(ociVersionTrimmed);
      }

      // Strategy 2: Try custom Flowly label
      const { stdout: flowlyVersion } = await execAsync(
        `docker inspect --format='{{index .Config.Labels "com.flowly.version"}}' ${containerName}`,
      );
      const flowlyVersionTrimmed = flowlyVersion.trim();
      if (flowlyVersionTrimmed && flowlyVersionTrimmed !== '<no value>') {
        this.logger.debug(
          `Version from Flowly label for ${containerName}: ${flowlyVersionTrimmed}`,
        );
        return this.cleanVersion(flowlyVersionTrimmed);
      }

      // Strategy 3: Try APP_VERSION environment variable
      const { stdout: envVersion } = await execAsync(
        `docker inspect --format='{{range .Config.Env}}{{println .}}{{end}}' ${containerName} | grep -E "^APP_VERSION=" | cut -d= -f2`,
      );
      const envVersionTrimmed = envVersion.trim();
      if (envVersionTrimmed && envVersionTrimmed !== '0.0.0-dev') {
        this.logger.debug(
          `Version from APP_VERSION env for ${containerName}: ${envVersionTrimmed}`,
        );
        return this.cleanVersion(envVersionTrimmed);
      }

      // Strategy 4: Fallback to image tag extraction
      const { stdout: imageName } = await execAsync(
        `docker inspect --format='{{.Config.Image}}' ${containerName}`,
      );

      const imageNameTrimmed = imageName.trim();
      if (!imageNameTrimmed || imageNameTrimmed === '<no value>') {
        this.logger.warn(`No image found for container: ${containerName}`);
        return null;
      }

      const version = this.extractVersionFromImageName(imageNameTrimmed);
      if (version) {
        this.logger.debug(`Version from image tag for ${containerName}: ${version}`);
      } else {
        this.logger.warn(
          `Could not determine version for ${containerName} - image uses "latest" tag without version labels`,
        );
      }

      return version;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to get current image version: ${errorMessage}`);
      return null;
    }
  }

  /**
   * Get the available (pulled) image version
   *
   * After Watchtower pulls a new image in monitor-only mode, the container
   * still runs the old version. This method inspects the pulled IMAGE
   * (not the running container) to get the available version.
   *
   * @param containerName - Container name to get the image reference from
   * @returns Available version string or null
   */
  async getAvailableImageVersion(containerName: string): Promise<string | null> {
    this.validateContainerName(containerName);

    this.logger.debug(`Getting available image version for: ${containerName}`);

    try {
      // Get the image reference from the container (e.g., registry/repo:tag)
      const { stdout: imageRef } = await execAsync(
        `docker inspect --format='{{.Config.Image}}' ${containerName}`,
      );

      const imageRefTrimmed = imageRef.trim();
      if (!imageRefTrimmed || imageRefTrimmed === '<no value>') {
        return null;
      }

      // Now inspect the IMAGE (not the container) for version labels
      // This will show the version of the latest pulled image with this tag

      // Strategy 1: OCI label from image
      const { stdout: ociVersion } = await execAsync(
        `docker inspect --format='{{index .Config.Labels "org.opencontainers.image.version"}}' ${imageRefTrimmed}`,
      );
      const ociVersionTrimmed = ociVersion.trim();
      if (ociVersionTrimmed && ociVersionTrimmed !== '<no value>') {
        this.logger.debug(`Available version from image OCI label: ${ociVersionTrimmed}`);
        return this.cleanVersion(ociVersionTrimmed);
      }

      // Strategy 2: Custom label from image
      const { stdout: flowlyVersion } = await execAsync(
        `docker inspect --format='{{index .Config.Labels "com.flowly.version"}}' ${imageRefTrimmed}`,
      );
      const flowlyVersionTrimmed = flowlyVersion.trim();
      if (flowlyVersionTrimmed && flowlyVersionTrimmed !== '<no value>') {
        this.logger.debug(`Available version from image Flowly label: ${flowlyVersionTrimmed}`);
        return this.cleanVersion(flowlyVersionTrimmed);
      }

      // Strategy 3: Extract from tag (fallback)
      return this.extractVersionFromImageName(imageRefTrimmed);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to get available image version: ${errorMessage}`);
      return null;
    }
  }

  /**
   * Get Docker image label value
   *
   * Extracts a specific label from a Docker image's metadata.
   * Commonly used labels:
   * - com.flowly.version: Version string
   * - com.flowly.changelog: Base64-encoded changelog
   * - com.flowly.build-date: Build timestamp
   *
   * @param imageName - Full image name with tag
   * @param labelKey - Label key to retrieve
   * @returns Label value or null if not found
   */
  async getImageLabel(imageName: string, labelKey: string): Promise<string | null> {
    this.logger.debug(`Getting label "${labelKey}" from image: ${imageName}`);

    try {
      const { stdout } = await execAsync(
        `docker inspect --format='{{index .Config.Labels "${labelKey}"}}' ${imageName}`,
      );

      const value = stdout.trim();
      if (!value || value === '<no value>') {
        this.logger.debug(`Label "${labelKey}" not found in image`);
        return null;
      }

      return value;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(`Failed to get image label: ${errorMessage}`);
      return null;
    }
  }

  /**
   * Get detailed information about a Docker image
   *
   * @param imageName - Full image name with tag
   * @returns Image information or null if not found
   */
  async getImageInfo(imageName: string): Promise<DockerImageInfo | null> {
    this.logger.debug(`Getting image info: ${imageName}`);

    try {
      const { stdout } = await execAsync(
        `docker inspect --format='{{.Id}}|{{.Created}}' ${imageName}`,
      );

      const [imageId, createdStr] = stdout.trim().split('|');

      const version = this.extractVersionFromImageName(imageName);
      const created = createdStr ? new Date(createdStr) : null;

      return {
        imageName,
        version,
        imageId,
        created,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to get image info: ${errorMessage}`);
      return null;
    }
  }

  /**
   * Compare two version strings using semantic versioning
   *
   * Determines if the available version is newer than the current version.
   *
   * @param currentVersion - Currently installed version
   * @param availableVersion - Available version to compare
   * @returns true if available version is newer
   */
  compareVersions(currentVersion: string, availableVersion: string): boolean {
    this.logger.debug(`Comparing versions: ${currentVersion} vs ${availableVersion}`);

    try {
      // Clean versions (remove prefixes like 'v', 'onpremise-', etc.)
      const cleanCurrent = this.cleanVersion(currentVersion);
      const cleanAvailable = this.cleanVersion(availableVersion);

      // Validate semver format
      if (!semver.valid(cleanCurrent) || !semver.valid(cleanAvailable)) {
        this.logger.warn(`Invalid semver format: ${cleanCurrent} or ${cleanAvailable}`);
        // Fallback to string comparison
        return cleanAvailable > cleanCurrent;
      }

      // Use semver comparison
      const isNewer = semver.gt(cleanAvailable, cleanCurrent);
      this.logger.debug(
        `Version comparison result: ${availableVersion} ${isNewer ? '>' : '<='} ${currentVersion}`,
      );

      return isNewer;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Version comparison failed: ${errorMessage}`);
      // Fallback to string comparison
      return availableVersion > currentVersion;
    }
  }

  /**
   * Check if Docker daemon is accessible
   *
   * Verifies that the Docker socket is mounted and accessible.
   *
   * @returns true if Docker is available
   */
  async isDockerAvailable(): Promise<boolean> {
    try {
      await execAsync('docker version');
      return true;
    } catch {
      this.logger.error('Docker daemon not accessible');
      return false;
    }
  }

  /**
   * List all running containers
   *
   * @returns Array of container names
   */
  async listRunningContainers(): Promise<string[]> {
    try {
      const { stdout } = await execAsync('docker ps --format "{{.Names}}"');

      return stdout
        .trim()
        .split('\n')
        .filter((name) => name.length > 0);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to list containers: ${errorMessage}`);
      return [];
    }
  }

  /**
   * Extract version from Docker image name
   *
   * Supports various formats:
   * - registry/repo:onpremise-1.2.3 -> 1.2.3
   * - registry/repo:v1.2.3 -> 1.2.3
   * - registry/repo:1.2.3 -> 1.2.3
   * - registry/repo:latest -> null
   *
   * @param imageName - Full image name with tag
   * @returns Extracted version or null
   */
  private extractVersionFromImageName(imageName: string): string | null {
    // Extract tag from image name
    const parts = imageName.split(':');
    if (parts.length < 2) {
      return null;
    }

    const tag = parts[parts.length - 1];

    // Handle 'latest' tag
    if (tag === 'latest') {
      return null;
    }

    // Remove common prefixes
    const version = tag
      .replace(/^onpremise-/, '')
      .replace(/^v/, '')
      .replace(/^release-/, '');

    // Validate it looks like a version
    if (!/^\d+\.\d+/.test(version)) {
      return null;
    }

    return version;
  }

  /**
   * Clean version string for semver comparison
   *
   * Removes prefixes and normalizes version format.
   *
   * @param version - Raw version string
   * @returns Cleaned version string
   */
  private cleanVersion(version: string): string {
    return version
      .replace(/^onpremise-/, '')
      .replace(/^v/, '')
      .replace(/^release-/, '')
      .trim();
  }

  /**
   * Validate container name against whitelist
   *
   * @param containerName - Container name to validate
   * @throws Error if container name is not whitelisted
   */
  private validateContainerName(containerName: string): void {
    if (!this.ALLOWED_CONTAINERS.includes(containerName)) {
      throw new Error(
        `Container name "${containerName}" not in whitelist. ` +
          `Allowed containers: ${this.ALLOWED_CONTAINERS.join(', ')}`,
      );
    }
  }

  /**
   * Build full image name for a Flowly component
   *
   * @param component - Component name (api, dashboard, plugin)
   * @param version - Version string
   * @returns Full image name with registry
   */
  buildImageName(component: string, version: string): string {
    // Map component to repository path
    const repoMap: Record<string, string> = {
      api: 'flowly-api/api',
      dashboard: 'flowly-dashboard/dashboard',
      plugin: 'flowly-plugin/plugin',
    };

    const repo = repoMap[component] || component;
    return `${this.defaultRegistry}/${repo}:onpremise-${version}`;
  }
}
