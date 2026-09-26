import { Injectable, Logger } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { QuestionLessonDependencyEntity } from '../../entities/questionLessonDependency.entity';
import { LessonContentChunkEntity } from '../../entities/lessonContentChunk.entity';
import { LessonRubricEntity } from '../../entities/lessonRubric.entity';

export interface EvaluationContext {
  questionId: string;
  lessonIds: string[];
  rubrics: Array<{ lessonId: string; lessonName?: string; keyPoints: any[]; rubricVersion: number }>;
  retrievedChunks: Array<{ lessonId: string; lessonName?: string; chunkText: string; rank: number }>;
  groundingSourcePlan: 'rubric' | 'rubric_with_retrieval_fallback' | 'module_fallback' | 'no_lesson_dependency';
  contentVersionsUsed: Array<{ lessonId: string; contentVersion: number; rubricVersion: number }>;
}

@Injectable()
export class EvaluationContextBuilderService {
  private readonly logger = new Logger(EvaluationContextBuilderService.name);
  private qldRepo: Repository<QuestionLessonDependencyEntity>;
  private rubricRepo: Repository<LessonRubricEntity>;

  constructor(private readonly datasource: DataSource) {
    this.qldRepo = this.datasource.getRepository(QuestionLessonDependencyEntity);
    this.rubricRepo = this.datasource.getRepository(LessonRubricEntity);
  }

  async buildContextForQuestion(
    questionId: string,
    traineeAnswerText: string,
    questionText: string,
    rubricCache: Map<string, LessonRubricEntity>
  ): Promise<EvaluationContext> {
    const deps = await this.qldRepo.find({ where: { questionId }, relations: ['lesson'] });
    const lessonIds = deps.map(d => d.lesson.id);
    const lessonNames = new Map(deps.map(d => [d.lesson.id, d.lesson.title]));

    if (lessonIds.length === 0) {
      return {
        questionId,
        lessonIds: [],
        rubrics: [],
        retrievedChunks: [],
        groundingSourcePlan: 'no_lesson_dependency',
        contentVersionsUsed: []
      };
    }

    const rubrics: LessonRubricEntity[] = [];
    for (const id of lessonIds) {
      if (!rubricCache.has(id)) {
        const r = await this.rubricRepo.findOne({
          where: { lesson: { id } },
          relations: ['lesson'],
          order: { rubricVersion: 'DESC' }
        });
        if (r) rubricCache.set(id, r);
      }
      const cached = rubricCache.get(id);
      if (cached) rubrics.push(cached);
    }

    const missingRubric = rubrics.length === 0 || rubrics.some(r => r.generationStatus !== 'SUCCESS');
    
    // Always run retrieval as supplementary verification
    const query = `${questionText} ${traineeAnswerText}`;
    const retrievedChunks = await this.searchLessonChunks(lessonIds, query, 3);
    
    // Attach lesson names to chunks for prompting
    retrievedChunks.forEach((c: any) => {
      c.lessonName = lessonNames.get(c.lessonId) || 'Unknown Lesson';
    });

    return {
      questionId,
      lessonIds,
      rubrics: rubrics.filter(r => r.generationStatus === 'SUCCESS').map(r => ({
        lessonId: r.lesson.id,
        lessonName: lessonNames.get(r.lesson.id) || 'Unknown Lesson',
        keyPoints: r.keyPoints,
        rubricVersion: r.rubricVersion
      })),
      retrievedChunks,
      groundingSourcePlan: missingRubric ? 'module_fallback' : 'rubric_with_retrieval_fallback',
      contentVersionsUsed: rubrics.map(r => ({
        lessonId: r.lesson.id,
        contentVersion: r.contentVersion,
        rubricVersion: r.rubricVersion
      }))
    };
  }

  private async searchLessonChunks(lessonIds: string[], query: string, topK: number) {
     if (!lessonIds.length) return [];
     
     const queryStr = `
       SELECT lesson_id AS "lessonId", chunk_text AS "chunkText", 
              ts_rank(search_vector, plainto_tsquery('english', $1)) AS rank
       FROM "LessonContentChunk"
       WHERE lesson_id = ANY($2)
         AND search_vector IS NOT NULL
       ORDER BY rank DESC
       LIMIT $3
     `;
     
     try {
       const res = await this.datasource.query(queryStr, [query, lessonIds, topK]);
       return res.filter((r: any) => r.rank > 0.01).map((r: any) => ({
         lessonId: r.lessonId,
         chunkText: r.chunkText,
         rank: r.rank
       }));
     } catch (e) {
       this.logger.error('Full-text search failed', e);
       return [];
     }
  }
}
