"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const app_module_1 = require("./app.module");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    app.enableCors({
        origin: 'http://localhost:5173',
        methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
        credentials: true, // Allow cookies and authorization headers
    });
    const port = process.env.PORT ?? 3000;
    await app.listen(port);
    console.log(`App is listening on port ${port}`);
}
bootstrap();
//# sourceMappingURL=main.js.map