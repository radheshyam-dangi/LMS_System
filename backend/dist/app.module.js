"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const typeorm_1 = require("@nestjs/typeorm");
const data_source_1 = require("./config/data-source"); // Import our new data source
const user_module_1 = require("./databaseOrm/modules/user/user.module");
const role_module_1 = require("./databaseOrm/modules/role/role.module");
const assignment_module_1 = require("./databaseOrm/modules/assignment/assignment.module");
const lesson_module_1 = require("./databaseOrm/modules/lesson/lesson.module");
const learningPath_module_1 = require("./databaseOrm/modules/learningPath/learningPath.module");
const module_module_1 = require("./databaseOrm/modules/module/module.module");
const evaluation_module_1 = require("./databaseOrm/modules/evaluation/evaluation.module");
const document_module_1 = require("./databaseOrm/modules/document/document.module");
const submission_module_1 = require("./databaseOrm/modules/submission/submission.module");
const tag_module_1 = require("./databaseOrm/modules/tag/tag.module");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({
                isGlobal: true,
            }),
            // Pass the AppDataSource options directly into TypeOrmModule
            typeorm_1.TypeOrmModule.forRoot(data_source_1.AppDataSource.options),
            user_module_1.UserModule,
            role_module_1.RoleModule,
            assignment_module_1.AssignmentModule,
            lesson_module_1.LessonModule,
            learningPath_module_1.LearningPathModule,
            module_module_1.ModuleModule,
            evaluation_module_1.EvaluationModule,
            document_module_1.DocumentModule,
            submission_module_1.SubmissionModule,
            tag_module_1.TagModule,
        ],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map