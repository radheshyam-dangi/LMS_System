import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TrainerAiAssistantController } from './trainerAiAssistant.controller';
import { TrainerAiAssistantService } from './trainerAiAssistant.service';
import { TrainerAiIntentService } from './trainerAiIntent.service';
import { TrainerLpQaService } from './trainerLpQa.service';
import { TrainerLpGenerationService } from './trainerLpGeneration.service';
import { TrainerLpUpgradeService } from './trainerLpUpgrade.service';
import { TrainerActionService } from './trainerAction.service';

import { TrainerAiConversationEntity } from '../../entities/trainerAiConversation.entity';
import { TrainerAiMessageEntity } from '../../entities/trainerAiMessage.entity';
import { AssistantActionEntity } from '../../entities/assistantAction.entity';
import { AssistantAuditEntity } from '../../entities/assistantAudit.entity';
import { LearningPathEntity } from '../../entities/learningPath.entity';

import { AuthModule } from '../../auth/auth.module';
import { LpAuthoringModule } from '../lpAuthoring/lpAuthoring.module';
import { LearningPathModule } from '../learningPath/learningPath.module';
import { AiAssistantModule } from '../aiAssistant/aiAssistant.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TrainerAiConversationEntity,
      TrainerAiMessageEntity,
      AssistantActionEntity,
      AssistantAuditEntity,
      LearningPathEntity,
    ]),
    AuthModule,
    forwardRef(() => LpAuthoringModule),
    forwardRef(() => LearningPathModule),
    forwardRef(() => AiAssistantModule),
  ],
  controllers: [TrainerAiAssistantController],
  providers: [
    TrainerAiAssistantService,
    TrainerAiIntentService,
    TrainerLpQaService,
    TrainerLpGenerationService,
    TrainerLpUpgradeService,
    TrainerActionService,
  ],
  exports: [TrainerAiAssistantService, TrainerActionService, TrainerLpUpgradeService],
})
export class TrainerAiAssistantModule {}
