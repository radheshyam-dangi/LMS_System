const fs = require('fs');
const path = require('path');
const p = path.join(__dirname, '../src/databaseOrm/modules/assignment/assignment.controller.ts');
let code = fs.readFileSync(p, 'utf8');

const newEndpoints = `
  @Get(':id/questions/:questionId/lesson-options')
  @Roles('Admin', 'Trainer')
  async getQuestionLessonOptions(
    @Param('id') assignmentId: string,
    @Param('questionId') questionId: string
  ) {
    return await this.assignmentService.getQuestionLessonOptions(assignmentId, questionId);
  }

  @Put(':id/questions/:questionId/lesson-dependencies')
  @Roles('Admin', 'Trainer')
  async setQuestionLessonDependencies(
    @Param('id') assignmentId: string,
    @Param('questionId') questionId: string,
    @Body() body: { lessonIds: string[], requiresLessonGrounding?: boolean }
  ) {
    return await this.assignmentService.setQuestionLessonDependencies(assignmentId, questionId, body.lessonIds, body.requiresLessonGrounding !== false);
  }

  @Get(':id/questions-extended')
  @Roles('Admin', 'Trainer', 'Trainee')
  async getQuestionsWithDependencies(
    @Param('id') assignmentId: string
  ) {
    return await this.assignmentService.getQuestionsWithDependencies(assignmentId);
  }

  @Post(':id/validate')
  @Roles('Admin', 'Trainer')
  async validateAssignmentBeforePublish(
    @Param('id') assignmentId: string
  ) {
    return await this.assignmentService.validateAssignmentBeforePublish(assignmentId);
  }

  @Get(':id/migration-review-queue')
  @Roles('Admin', 'Trainer')
  async getMigrationReviewQueue(
    @Param('id') assignmentId: string
  ) {
    return await this.assignmentService.getMigrationReviewQueue(assignmentId);
  }
`;

if (!code.includes('getQuestionLessonOptions')) {
  code = code.replace(
    "async deleteAssignment(@Param('id') id: string, @GetUser() currentUser: any) {",
    newEndpoints + "\n\n  async deleteAssignment(@Param('id') id: string, @GetUser() currentUser: any) {"
  );
  fs.writeFileSync(p, code);
}
