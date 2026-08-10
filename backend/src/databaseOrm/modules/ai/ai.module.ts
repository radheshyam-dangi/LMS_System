import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiController } from './ai.controller';
import { AiEntityService } from './ai.service';
import { AiConversationEntity } from '../../entities/aiConversation.entity';
import { AiMessageEntity } from '../../entities/aiMessage.entity';
import { AiFeedbackEntity } from '../../entities/aiFeedback.entity';

@Module({
  imports: [TypeOrmModule.forFeature([AiConversationEntity, AiMessageEntity, AiFeedbackEntity])],
  controllers: [AiController],
  providers: [AiEntityService],
  exports: [AiEntityService],
})
export class AiModule {}
