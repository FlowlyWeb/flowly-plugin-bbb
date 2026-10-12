import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { DynamicOriginsCacheService } from '../services/dynamic-origins-cache.service';

@Injectable()
export class OriginsUpdateListener {
  constructor(private dynamicOriginsCacheService: DynamicOriginsCacheService) {}

  @OnEvent('institution.created')
  @OnEvent('institution.updated')
  @OnEvent('institution.deleted')
  async handleInstitutionChange() {
    await this.dynamicOriginsCacheService.refreshOrigins();
  }
}
