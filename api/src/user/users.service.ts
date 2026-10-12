import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import * as bcrypt from 'bcrypt';

// Import DTOs from separate files
export { CreateUserDto } from './dto/create-user.dto';
export { UpdateUserDto } from './dto/update-user.dto';
export { UserResponseDto } from './dto/user-response.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserResponseDto } from './dto/user-response.dto';

/**
 * Service for managing users
 *
 * Handles user CRUD operations within an institution.
 * All users within an institution have equal permissions.
 */
@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  /**
   * Creates a new user in the institution
   *
   * @param institutionId - Institution ID
   * @param createUserDto - User creation data
   * @returns Created user
   */
  async createUser(institutionId: string, createUserDto: CreateUserDto): Promise<UserResponseDto> {
    const existingUser = await this.userRepository.findOne({
      where: { email: createUserDto.email },
    });

    if (existingUser) {
      throw new ConflictException('Email already exists');
    }

    const passwordHash = await bcrypt.hash(createUserDto.password, 10);

    const user = this.userRepository.create({
      email: createUserDto.email,
      passwordHash,
      firstName: createUserDto.firstName,
      lastName: createUserDto.lastName,
      institution: { id: institutionId },
      isActive: true,
    });

    const savedUser = await this.userRepository.save(user);
    return new UserResponseDto(savedUser);
  }

  /**
   * Retrieves all users in the institution
   *
   * @param institutionId - Institution ID
   * @returns Array of users
   */
  async getInstitutionUsers(institutionId: string): Promise<UserResponseDto[]> {
    const users = await this.userRepository.find({
      where: {
        institution: { id: institutionId },
      },
      order: {
        createdAt: 'DESC',
      },
    });

    return users.map((user) => new UserResponseDto(user));
  }

  /**
   * Retrieves a specific user by ID
   *
   * @param userId - User ID
   * @param institutionId - Institution ID
   * @returns User data
   */
  async getUserById(userId: string, institutionId: string): Promise<UserResponseDto> {
    const user = await this.userRepository.findOne({
      where: {
        id: userId,
        institution: { id: institutionId },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return new UserResponseDto(user);
  }

  /**
   * Updates a user
   *
   * @param userId - User ID
   * @param institutionId - Institution ID
   * @param updateUserDto - Update data
   * @returns Updated user
   */
  async updateUser(
    userId: string,
    institutionId: string,
    updateUserDto: UpdateUserDto,
  ): Promise<UserResponseDto> {
    const user = await this.userRepository.findOne({
      where: {
        id: userId,
        institution: { id: institutionId },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Update fields
    if (updateUserDto.firstName) user.firstName = updateUserDto.firstName;
    if (updateUserDto.lastName) user.lastName = updateUserDto.lastName;
    if (updateUserDto.isActive !== undefined) user.isActive = updateUserDto.isActive;

    const updatedUser = await this.userRepository.save(user);
    return new UserResponseDto(updatedUser);
  }

  /**
   * Deletes a user
   *
   * @param userId - User ID
   * @param institutionId - Institution ID
   */
  async deleteUser(userId: string, institutionId: string): Promise<void> {
    const user = await this.userRepository.findOne({
      where: {
        id: userId,
        institution: { id: institutionId },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.userRepository.remove(user);
  }

  /**
   * Retrieves the current authenticated user
   *
   * @param userId - User ID from JWT
   * @returns User data
   */
  async getCurrentUser(userId: string): Promise<UserResponseDto> {
    // Guard against an undefined id: TypeORM would ignore the condition and match any user
    if (!userId) {
      throw new NotFoundException('Current user not found');
    }

    const user = await this.userRepository.findOne({
      where: {
        id: userId,
        isActive: true,
      },
    });

    if (!user) {
      throw new NotFoundException('Current user not found');
    }

    return new UserResponseDto(user);
  }
}
