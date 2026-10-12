export const UnauthorizedResponse = {
  status: 401,
  description: 'Unauthorized - Invalid or missing JWT token',
  schema: {
    type: 'object',
    properties: {
      statusCode: { type: 'number', example: 401 },
      message: { type: 'string', example: 'Unauthorized' },
      error: { type: 'string', example: 'Invalid token' },
    },
  },
};

export const RateLimitResponse = {
  status: 429,
  description: 'Too Many Requests',
  schema: {
    type: 'object',
    properties: {
      statusCode: { type: 'number', example: 429 },
      message: { type: 'string', example: 'Too Many Requests' },
      error: { type: 'string', example: 'Rate limit exceeded' },
    },
  },
};
