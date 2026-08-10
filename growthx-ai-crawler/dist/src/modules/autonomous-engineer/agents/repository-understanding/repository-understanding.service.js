"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var RepositoryUnderstandingService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.RepositoryUnderstandingService = void 0;
const common_1 = require("@nestjs/common");
const fs = require("fs/promises");
const path = require("path");
let RepositoryUnderstandingService = RepositoryUnderstandingService_1 = class RepositoryUnderstandingService {
    constructor() {
        this.logger = new common_1.Logger(RepositoryUnderstandingService_1.name);
    }
    async analyzeRepository(repoDir) {
        this.logger.log(`Analyzing repository structure in ${repoDir}...`);
        const context = {
            framework: 'Unknown',
            isMonorepo: false,
            packageManager: 'npm',
            dependencies: {},
        };
        try {
            // Check package manager lock files
            const files = await fs.readdir(repoDir);
            if (files.includes('yarn.lock'))
                context.packageManager = 'yarn';
            else if (files.includes('pnpm-lock.yaml'))
                context.packageManager = 'pnpm';
            else if (files.includes('bun.lockb'))
                context.packageManager = 'bun';
            // Parse package.json
            if (files.includes('package.json')) {
                const pkgStr = await fs.readFile(path.join(repoDir, 'package.json'), 'utf-8');
                const pkg = JSON.parse(pkgStr);
                context.dependencies = {
                    ...(pkg.dependencies || {}),
                    ...(pkg.devDependencies || {}),
                };
                if (context.dependencies['next'])
                    context.framework = 'Next.js';
                else if (context.dependencies['nuxt'])
                    context.framework = 'Nuxt';
                else if (context.dependencies['astro'])
                    context.framework = 'Astro';
                else if (context.dependencies['@angular/core'])
                    context.framework = 'Angular';
                else if (context.dependencies['vue'])
                    context.framework = 'Vue';
                else if (context.dependencies['react'])
                    context.framework = 'React';
                if (pkg.workspaces)
                    context.isMonorepo = true;
            }
        }
        catch (e) {
            this.logger.error(`Failed to analyze repository: ${e.message}`);
        }
        this.logger.log(`Detected framework: ${context.framework} (${context.packageManager})`);
        return context;
    }
};
exports.RepositoryUnderstandingService = RepositoryUnderstandingService;
exports.RepositoryUnderstandingService = RepositoryUnderstandingService = RepositoryUnderstandingService_1 = __decorate([
    (0, common_1.Injectable)()
], RepositoryUnderstandingService);
//# sourceMappingURL=repository-understanding.service.js.map