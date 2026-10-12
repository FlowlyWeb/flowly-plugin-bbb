import { plainToClass } from 'class-transformer';
import { IsEnum, IsNumber, IsString, validateSync } from 'class-validator';

enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

class EnvironmentVariables {
  @IsEnum(Environment)
  NODE_ENV: Environment;

  @IsNumber()
  PORT: number;

  @IsString()
  DB_HOST: string;

  @IsNumber()
  DB_PORT: number;

  @IsString()
  DB_NAME: string;

  @IsString()
  DB_USER: string;

  @IsString()
  DB_PASS: string;

  @IsString()
  JWT_SECRET: string;

  @IsString()
  LOG_LEVEL: string;
}

export function validate(_config: Record<string, unknown>) {
  // Nous récupérons directement les variables d'environnement plutôt que d'utiliser
  // l'objet config passé en paramètre
  const validatedConfig = plainToClass(EnvironmentVariables, {
    NODE_ENV: process.env.NODE_ENV,
    PORT: parseInt(process.env.PORT || '', 10),
    DB_HOST: process.env.DB_HOST,
    DB_PORT: parseInt(process.env.DB_PORT || '', 10),
    DB_NAME: process.env.DB_NAME,
    DB_USER: process.env.DB_USER,
    DB_PASS: process.env.DB_PASS,
    JWT_SECRET: process.env.JWT_SECRET,
    LOG_LEVEL: process.env.LOG_LEVEL || 'info',
  });

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    // eslint-disable-next-line no-console
    console.error('Configuration validation errors:');
    errors.forEach((error) => {
      const constraints = error.constraints ? Object.values(error.constraints) : [];
      // eslint-disable-next-line no-console
      console.error(`${error.property}:`, constraints.join(', '));
    });
    throw new Error('Configuration validation failed. Check the console for details.');
  }

  return validatedConfig;
}
