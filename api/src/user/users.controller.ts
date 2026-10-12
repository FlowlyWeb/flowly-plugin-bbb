import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Request,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
  ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { UsersService, CreateUserDto, UpdateUserDto, UserResponseDto } from './users.service';

/**
 * Users controller
 *
 * All authenticated users have equal access to user management endpoints.
 * No role-based permissions system.
 */
@ApiTags('Users')
@Controller('users')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @ApiOperation({
    summary: 'Get current user information',
    description: 'Returns information about the authenticated user',
  })
  @ApiResponse({
    status: 200,
    description: 'Current user information',
    type: UserResponseDto,
  })
  async getCurrentUser(@Request() req) {
    // JwtStrategy exposes the user id as `userId` (there is no `id` field)
    return this.usersService.getCurrentUser(req.user.userId);
  }

  @Get()
  @ApiOperation({
    summary: 'Get all users in institution',
    description: 'Returns list of all users in the institution',
  })
  @ApiResponse({
    status: 200,
    description: 'List of users in the institution',
    type: [UserResponseDto],
  })
  async getInstitutionUsers(@Request() req) {
    return this.usersService.getInstitutionUsers(req.user.institutionId);
  }

  @Post()
  @ApiOperation({
    summary: 'Create new user',
    description: 'Creates a new user in the institution',
  })
  @ApiBody({ type: CreateUserDto })
  @ApiResponse({
    status: 201,
    description: 'User created successfully',
    type: UserResponseDto,
  })
  @ApiResponse({
    status: 409,
    description: 'Email already exists',
  })
  async createUser(@Body(ValidationPipe) createUserDto: CreateUserDto, @Request() req) {
    return this.usersService.createUser(req.user.institutionId, createUserDto);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get user by ID',
    description: 'Returns information about a specific user',
  })
  @ApiParam({
    name: 'id',
    description: 'User ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'User information',
    type: UserResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
  })
  async getUserById(@Param('id') userId: string, @Request() req) {
    return this.usersService.getUserById(userId, req.user.institutionId);
  }

  @Put(':id')
  @ApiOperation({
    summary: 'Update user',
    description: 'Updates user information',
  })
  @ApiParam({
    name: 'id',
    description: 'User ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiBody({ type: UpdateUserDto })
  @ApiResponse({
    status: 200,
    description: 'User updated successfully',
    type: UserResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
  })
  async updateUser(
    @Param('id') userId: string,
    @Body(ValidationPipe) updateUserDto: UpdateUserDto,
    @Request() req,
  ) {
    return this.usersService.updateUser(userId, req.user.institutionId, updateUserDto);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete user',
    description: 'Deletes a user from the institution',
  })
  @ApiParam({
    name: 'id',
    description: 'User ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'User deleted successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
  })
  async deleteUser(@Param('id') userId: string, @Request() req) {
    await this.usersService.deleteUser(userId, req.user.institutionId);
    return { message: 'User deleted successfully' };
  }
}
