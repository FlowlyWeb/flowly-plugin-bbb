import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import { WatchtowerScanResponse, WatchtowerScanResult } from '../interfaces/watchtower.interface';

/**
 * Watchtower Client Service
 *
 * Handles communication with the Watchtower HTTP API for container update management.
 * Watchtower monitors Docker containers and can automatically update them when new
 * images are available.
 *
 * This service provides:
 * - Manual scan triggering (monitor-only mode)
 * - Metrics retrieval
 * - Health check/ping functionality
 * - Response caching for resilience
 *
 * Configuration:
 * - WATCHTOWER_API_URL: Base URL for Watchtower API (default: http://localhost:8080)
 * - WATCHTOWER_TOKEN: Bearer token for API authentication
 *
 * @see https://containrrr.dev/watchtower/http-api-mode/
 */
@Injectable()
export class WatchtowerClientService {
  private readonly logger = new Logger(WatchtowerClientService.name);
  private readonly httpClient: AxiosInstance;
  private readonly apiUrl: string;

  /**
   * Cache of the last successful scan result
   * Used for graceful degradation when Watchtower is unavailable
   */
  private lastScanResult: WatchtowerScanResult | null = null;

  /**
   * Timestamp of the last successful scan
   */
  private lastScanTime: Date | null = null;

  /**
   * Cache duration in milliseconds (5 minutes)
   */
  private readonly CACHE_DURATION_MS = 5 * 60 * 1000;

  /**
   * Cooldown period between manual scans in milliseconds (1 minute)
   * Prevents excessive API calls
   */
  private readonly SCAN_COOLDOWN_MS = 60 * 1000;

  constructor(private readonly configService: ConfigService) {
    this.apiUrl = this.configService.get<string>('WATCHTOWER_API_URL') || 'http://localhost:8080';

    const token = this.configService.get<string>('WATCHTOWER_TOKEN');

    this.httpClient = axios.create({
      baseURL: this.apiUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
      },
    });

    this.logger.log(`Watchtower client initialized: ${this.apiUrl}`);
  }

  /**
   * Trigger a manual scan of monitored containers
   *
   * Sends a POST request to /v1/update to trigger Watchtower to check
   * for updates. When Watchtower is in monitor-only mode, it will scan
   * but not apply updates automatically.
   *
   * Results are cached for 5 minutes to prevent excessive scanning.
   * Enforces a 1-minute cooldown between manual scans.
   *
   * @param force - Force scan even if within cooldown period
   * @returns Scan result with update availability information
   * @throws Error if Watchtower is unavailable and no cache exists
   */
  async triggerScan(force = false): Promise<WatchtowerScanResult> {
    // Check cooldown period (unless forced)
    if (!force && this.lastScanTime) {
      const timeSinceLastScan = Date.now() - this.lastScanTime.getTime();
      if (timeSinceLastScan < this.SCAN_COOLDOWN_MS) {
        const remainingSeconds = Math.ceil((this.SCAN_COOLDOWN_MS - timeSinceLastScan) / 1000);
        this.logger.debug(
          `Scan cooldown active (${remainingSeconds}s remaining), returning cached result`,
        );
        if (this.lastScanResult) {
          return this.lastScanResult;
        }
      }
    }

    this.logger.log('Triggering Watchtower scan...');

    try {
      const response = await this.httpClient.post('/v1/update');

      const scanData = response.data as WatchtowerScanResponse | string;

      let result: WatchtowerScanResult;

      // Stable Watchtower (≤ 1.7.x) returns an empty body on success.
      // Return an optimistic result so that Docker inspection — which runs
      // next in the update flow — can confirm the actual state.
      if (!scanData || typeof scanData !== 'object') {
        this.logger.log(
          'Watchtower scan triggered (empty response — deferring version check to Docker inspection)',
        );
        result = {
          updateAvailable: true,
          scanned: 0,
          updated: 0,
          failed: 0,
          timestamp: new Date(),
          durationMs: 0,
        };
      } else {
        // Full JSON response (development / future stable builds)
        result = {
          updateAvailable: scanData.summary.updated > 0,
          scanned: scanData.summary.scanned,
          updated: scanData.summary.updated,
          failed: scanData.summary.failed,
          timestamp: new Date(scanData.timestamp),
          durationMs: scanData.timing.duration_ms,
        };
        this.logger.log(
          `Scan completed: ${result.scanned} scanned, ${result.updated} updates available, ${result.failed} failed (${result.durationMs}ms)`,
        );
      }

      // Cache the result
      this.lastScanResult = result;
      this.lastScanTime = new Date();

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Watchtower scan failed: ${errorMessage}`);

      // Return cached result if available and not too old
      if (this.lastScanResult && this.isCacheValid()) {
        this.logger.warn('Returning cached scan result due to error');
        return this.lastScanResult;
      }

      // No valid cache - throw error
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      throw new (Error as any)(`Watchtower unavailable: ${errorMessage}`, { cause: error });
    }
  }

  /**
   * Ping Watchtower to check network reachability
   *
   * Sends a HEAD request to the base URL. Any HTTP response (including 404)
   * confirms the server is reachable. Only network-level failures (connection
   * refused, timeout) are treated as "down".
   *
   * @returns true if Watchtower is reachable, false otherwise
   */
  async ping(): Promise<boolean> {
    try {
      await this.httpClient.head('/');
      return true;
    } catch (error) {
      // axios throws for both network errors AND non-2xx responses;
      // a response object present means the server answered — it is up
      if (error instanceof Error && 'response' in error && error.response) {
        return true;
      }
      this.logger.debug('Watchtower ping failed — server unreachable');
      return false;
    }
  }

  /**
   * Get the last cached scan result
   *
   * Returns the most recent scan result without triggering a new scan.
   * Useful for displaying status without making API calls.
   *
   * @returns Last scan result or null if no scan has been performed
   */
  getLastScanResult(): WatchtowerScanResult | null {
    return this.lastScanResult;
  }

  /**
   * Get the timestamp of the last scan
   *
   * @returns Date of last scan or null
   */
  getLastScanTime(): Date | null {
    return this.lastScanTime;
  }

  /**
   * Check if the cached scan result is still valid
   *
   * @returns true if cache exists and is within CACHE_DURATION_MS
   */
  private isCacheValid(): boolean {
    if (!this.lastScanTime) {
      return false;
    }

    const cacheAge = Date.now() - this.lastScanTime.getTime();
    return cacheAge < this.CACHE_DURATION_MS;
  }

  /**
   * Clear the cached scan result
   *
   * Useful for testing or forcing fresh scans.
   */
  clearCache(): void {
    this.lastScanResult = null;
    this.lastScanTime = null;
    this.logger.debug('Scan cache cleared');
  }
}
