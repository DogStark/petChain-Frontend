"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const helmet_1 = __importDefault(require("helmet"));
const app_module_1 = require("./app.module");
const audit_interceptor_1 = require("./audit/audit.interceptor");
const audit_service_1 = require("./audit/audit.service");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    const configService = app.get(config_1.ConfigService);
    const auditService = app.get(audit_service_1.AuditService);
    app.useGlobalInterceptors(new audit_interceptor_1.AuditInterceptor(auditService));
    app.getHttpAdapter().getInstance().set('trust proxy', true);
    app.use((0, helmet_1.default)({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                scriptSrc: ["'self'"],
                styleSrc: ["'self'", "'unsafe-inline'"],
                imgSrc: ["'self'", 'data:', 'https:'],
                connectSrc: ["'self'"],
                fontSrc: ["'self'", 'data:'],
                frameAncestors: ["'none'"],
            },
        },
        hsts: {
            maxAge: 31536000,
            includeSubDomains: true,
            preload: true,
        },
        referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    }));
    const rawOrigins = configService.get('app.corsOrigin') || 'http://localhost:3000';
    const allowedOrigins = rawOrigins.split(',').map((o) => o.trim());
    app.enableCors({
        origin: (origin, callback) => {
            if (!origin)
                return callback(null, true);
            if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
                return callback(null, true);
            }
            callback(new Error(`CORS: origin ${origin} not allowed`));
        },
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Api-Key'],
        exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining'],
        credentials: true,
        maxAge: 86400,
    });
    app.useGlobalPipes(new common_1.ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
    }));
    const apiPrefix = configService.get('app.apiPrefix') || 'api/v1';
    app.setGlobalPrefix(apiPrefix);
    const port = configService.get('app.port') || 3000;
    const server = await app.listen(port);
    server.keepAliveTimeout = 65000;
    server.headersTimeout = 66000;
    console.log(`🚀 Application is running on: http://localhost:${port}`);
    console.log(`📚 API Documentation: http://localhost:${port}/${apiPrefix}`);
}
void bootstrap();
//# sourceMappingURL=main.js.map