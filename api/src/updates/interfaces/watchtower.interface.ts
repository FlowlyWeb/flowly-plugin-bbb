/**
 * Watchtower API interfaces
 *
 * Type definitions for interacting with Watchtower's HTTP API.
 * Watchtower is a container update automation tool that monitors Docker
 * images and applies updates when new versions are available.
 *
 * @see https://containrrr.dev/watchtower/http-api-mode/
 */

/**
 * Response from Watchtower scan endpoint
 *
 * Returned by POST /v1/update when triggering a manual scan.
 * Contains information about scanned containers and update results.
 */
export interface WatchtowerScanResponse {
  /**
   * Summary of the scan operation
   */
  summary: {
    /**
     * Number of containers scanned
     */
    scanned: number;

    /**
     * Number of containers updated
     */
    updated: number;

    /**
     * Number of containers that failed to update
     */
    failed: number;

    /**
     * Number of containers restarted
     */
    restarted: number;
  };

  /**
   * Timing information for the scan
   */
  timing: {
    /**
     * Duration in milliseconds
     */
    duration_ms: number;

    /**
     * Human-readable duration string
     */
    duration: string;
  };

  /**
   * ISO 8601 timestamp of when the scan occurred
   */
  timestamp: string;

  /**
   * Watchtower API version
   */
  api_version: string;
}

/**
 * Processed scan result for internal use
 *
 * Simplified version of WatchtowerScanResponse with parsed timestamp
 * and update availability flag for easier consumption.
 */
export interface WatchtowerScanResult {
  /**
   * Whether updates are available (derived from summary.updated > 0)
   */
  updateAvailable: boolean;

  /**
   * Number of containers scanned
   */
  scanned: number;

  /**
   * Number of containers with available updates
   */
  updated: number;

  /**
   * Number of containers that failed to scan/update
   */
  failed: number;

  /**
   * Parsed timestamp of the scan
   */
  timestamp: Date;

  /**
   * Scan duration in milliseconds
   */
  durationMs: number;
}

/**
 * Watchtower error response
 *
 * Returned when an API request fails.
 */
export interface WatchtowerErrorResponse {
  /**
   * Error message
   */
  error: string;

  /**
   * HTTP status code
   */
  status: number;
}
