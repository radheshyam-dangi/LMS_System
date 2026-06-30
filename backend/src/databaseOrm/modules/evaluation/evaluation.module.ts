import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EvaluationController } from './evaluation.controller';
import { EvaluationService } from './evaluation.service';
import { EvaluationEntity } from '../../entities/evaluation.entity';

@Module({
  imports: [TypeOrmModule.forFeature([EvaluationEntity])],
  controllers: [EvaluationController],
  providers: [EvaluationService],
  exports: [EvaluationService],
})
export class EvaluationModule {}