import { RegisterDto } from './register.dto';

/**
 * DTO for the one-time admin setup endpoint (on-premise only).
 * Same fields as RegisterDto.
 */
export class SetupAdminDto extends RegisterDto {}
