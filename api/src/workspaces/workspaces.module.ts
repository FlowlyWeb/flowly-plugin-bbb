import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkspacesController } from './workspaces.controller';
import { WorkspacesService } from './workspaces.service';
import { Workspace } from '../institutions/entities/workspace.entity';
import { Style } from '../institutions/entities/style.entity';
import { Institution } from '../institutions/entities/institution.entity';

/**
 * Module for workspace management
 * Provides endpoints and services for creating and managing workspaces within institutions
 */
@Module({
  imports: [TypeOrmModule.forFeature([Workspace, Style, Institution])],
  controllers: [WorkspacesController],
  providers: [WorkspacesService],
  exports: [WorkspacesService],
})
export class WorkspacesModule {}
