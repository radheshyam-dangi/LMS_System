import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { EnrollmentEntity } from '../../entities/enrollment.entity';
import { UserEntity } from '../../entities/user.entity';
import { LearningPathEntity } from '../../entities/learningPath.entity';

@Injectable()
export class EnrollmentEntityService {
  private repository: Repository<EnrollmentEntity>;
  private userRepository: Repository<UserEntity>;
  private pathRepository: Repository<LearningPathEntity>;

  constructor(private readonly datasource: DataSource) {
    this.repository = this.datasource.getRepository(EnrollmentEntity);
    this.userRepository = this.datasource.getRepository(UserEntity);
    this.pathRepository = this.datasource.getRepository(LearningPathEntity);
  }

  async create(userId: string, learningPathId: string, status = 'active') {
    if (!userId || !learningPathId) {
      throw new BadRequestException('userId and learningPathId are required.');
    }

    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException(`User "${userId}" not found.`);

    const path = await this.pathRepository.findOne({ where: { id: learningPathId } });
    if (!path) throw new NotFoundException(`Learning path "${learningPathId}" not found.`);

    const existing = await this.repository.findOne({
      where: { user: { id: userId }, learningPath: { id: learningPathId } } as any,
      relations: ['user', 'learningPath'],
    });
    if (existing) return existing;

    return await this.repository.save(
      this.repository.create({
        user: { id: userId } as any,
        learningPath: { id: learningPathId } as any,
        status,
        enrolledAt: new Date(),
      }),
    );
  }

  async findAll(filters?: { userId?: string; learningPathId?: string }) {
    const where: any = {};
    if (filters?.userId) where.user = { id: filters.userId };
    if (filters?.learningPathId) where.learningPath = { id: filters.learningPathId };

    return await this.repository.find({
      where: Object.keys(where).length ? where : undefined,
      relations: ['user', 'learningPath'],
      order: { enrolledAt: 'DESC' },
    });
  }

  async findOne(id: string) {
    const enrollment = await this.repository.findOne({
      where: { id },
      relations: ['user', 'learningPath'],
    });
    if (!enrollment) throw new NotFoundException(`Enrollment "${id}" not found.`);
    return enrollment;
  }

  async update(id: string, dto: { status?: string }) {
    const enrollment = await this.findOne(id);
    if (dto.status) enrollment.status = dto.status;
    return await this.repository.save(enrollment);
  }

  async remove(id: string) {
    const enrollment = await this.findOne(id);
    await this.repository.remove(enrollment);
    return { deleted: true };
  }
}
