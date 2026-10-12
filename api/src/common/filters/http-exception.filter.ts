import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

/**
 * Global exception filter to catch all HTTP exceptions
 * Provides detailed error logging with context for debugging
 * Returns structured error responses to clients
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // Determine HTTP status code
    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    // Extract error message and details
    let message: string | object = 'Internal server error';
    let errorDetails: string | object | null = null;

    if (exception instanceof HttpException) {
      const exceptionResponse = exception.getResponse();
      message =
        typeof exceptionResponse === 'string'
          ? exceptionResponse
          : (exceptionResponse as Record<string, unknown>).message || exceptionResponse;
      errorDetails = typeof exceptionResponse === 'object' ? exceptionResponse : null;
    } else if (exception instanceof Error) {
      // Internal message, used for logging only (never returned to the client)
      message = exception.message;
    }

    // Build error context for logging
    const errorContext = {
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      statusCode: status,
      message,
      errorDetails,
      user:
        (request as Request & { user?: { userId?: string; institutionId?: string } }).user
          ?.userId || 'anonymous',
      institution:
        (request as Request & { user?: { userId?: string; institutionId?: string } }).user
          ?.institutionId || null,
      params: request.params,
      query: request.query,
      body: this.sanitizeBody(request.body),
      ip: request.ip,
      userAgent: request.get('user-agent'),
    };

    // Log error with full context
    if (status >= 500) {
      // Server errors - log with full stack trace
      this.logger.error(
        `[${request.method}] ${request.url} - ${status}`,
        exception instanceof Error ? exception.stack : JSON.stringify(exception),
        JSON.stringify(errorContext, null, 2),
      );
    } else if (status >= 400) {
      // Client errors - log as warning
      this.logger.warn(
        `[${request.method}] ${request.url} - ${status}: ${JSON.stringify(message)}`,
        JSON.stringify(errorContext, null, 2),
      );
    }

    const isDevelopment = process.env.NODE_ENV === 'development';
    const isServerError = status >= HttpStatus.INTERNAL_SERVER_ERROR;
    // Unexpected errors and 500s may carry internal details (SQL, paths, upstream errors)
    const hideMessage =
      !(exception instanceof HttpException) || status === HttpStatus.INTERNAL_SERVER_ERROR;

    // Build response payload
    const errorResponse = {
      statusCode: status,
      timestamp: errorContext.timestamp,
      path: request.url,
      // Never expose internal error messages to clients for server errors
      message: hideMessage ? 'Internal server error' : message,
      // Include additional details only in development
      ...(isDevelopment && errorDetails ? { details: errorDetails } : {}),
      // Include stack trace only in development for 500 errors
      ...(isDevelopment && isServerError && exception instanceof Error
        ? { stack: exception.stack }
        : {}),
    };

    response.status(status).json(errorResponse);
  }

  /**
   * Sanitize request body to remove sensitive data from logs.
   * Redacts (recursively) any key containing password, token, secret, apiKey or authorization,
   * e.g. password, currentPassword, newPassword, refresh_token, accessToken.
   */
  private sanitizeBody(body: unknown, depth = 0): unknown {
    if (!body || typeof body !== 'object') {
      return body;
    }

    if (depth > 5) {
      return '[TRUNCATED]';
    }

    if (Array.isArray(body)) {
      return body.map((item) => this.sanitizeBody(item, depth + 1));
    }

    const sensitiveKey = /password|token|secret|api[-_]?key|authorization/i;
    const sanitized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(body as Record<string, unknown>)) {
      sanitized[key] = sensitiveKey.test(key) ? '[REDACTED]' : this.sanitizeBody(value, depth + 1);
    }

    return sanitized;
  }
}
