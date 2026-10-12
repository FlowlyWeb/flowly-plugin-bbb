import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';

@Injectable()
export class CryptoService {
  generateChecksum(domain: string, name: string, apiKey: string): string {
    const data = `${domain}:${name}:${apiKey}`;
    return createHash('sha256').update(data).digest('hex');
  }

  validateChecksum(checksum: string, domain: string, name: string, apiKey: string): boolean {
    return checksum === this.generateChecksum(domain, name, apiKey);
  }
}
