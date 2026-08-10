import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EvaluationController } from './evaluation.controller';
import { EvaluationEntitytService } from './evaluation.service';
import { EvaluationEntity } from '../../entities/evaluation.entity';

@Module({
  imports: [TypeOrmModule.forFeature([EvaluationEntity])],
  controllers: [EvaluationController],
  providers: [EvaluationEntitytService],
  exports: [EvaluationEntitytService],
})
export class EvaluationModule {}