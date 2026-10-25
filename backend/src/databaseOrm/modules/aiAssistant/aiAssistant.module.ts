import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiAssistantController, AiAssistantAdminController } from './aiAssistant.controller';
import { AiAssistantService } from './aiAssistant.service';
import { AiAssistantRetrievalService } from './aiAssistantRetrieval.service';
import { EmbeddingOutboxService } from './embeddingOutbox.service';
import { AiAssistantConversationEntity } from '../../entities/aiAssistantConversation.entity';
import { AiAssistantMessageEntity } from '../../entities/aiAssistantMessage.entity';
import { EmbeddingOutboxEntity } from '../../entities/embeddingOutbox.entity';
import { LpEmbeddingChunkEntity } from '../../entities/lpEmbeddingChunk.entity';
import { AuthModule } from '../../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AiAssistantConversationEntity,
      AiAssistantMessageEntity,
      EmbeddingOutboxEntity,
      LpEmbeddingChunkEntity,
    ]),
    AuthModule,
  ],
  controllers: [AiAssistantController, AiAssistantAdminController],
  providers: [AiAssistantService, AiAssistantRetrievalService, EmbeddingOutboxService],
  exports: [EmbeddingOutboxService],
})
export class AiAssistantModule {}
