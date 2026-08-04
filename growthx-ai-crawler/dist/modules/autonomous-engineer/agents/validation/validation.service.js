"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var ValidationService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ValidationService = void 0;
const common_1 = require("@nestjs/common");
const child_process_1 = require("child_process");
const util_1 = require("util");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
let ValidationService = ValidationService_1 = class ValidationService {
    constructor() {
        this.logger = new common_1.Logger(ValidationService_1.name);
    }
    /**
     * Runs the validation step (e.g. npm run build or tsc) in the target repo.
     */
    async validateRepository(repoDir, packageManager) {
        this.logger.log(`Starting validation for repository at ${repoDir}...`);
        try {
            // 1. Install dependencies (Requires a sandbox in production)
            this.logger.log(`Running ${packageManager} install...`);
            await execAsync(`${packageManager} install`, { cwd: repoDir, timeout: 120000 });
            // 2. Run build
            this.logger.log(`Running ${packageManager} run build...`);
            const { stdout, stderr: _stderr } = await execAsync(`${packageManager} run build`, { cwd: repoDir, timeout: 180000 });
            this.logger.log(`Validation successful.`);
            return { success: true, output: stdout };
        }
        catch (error) {
            this.logger.error(`Validation failed: ${error.message}`);
            return { success: false, output: error.stdout || error.message };
        }
    }
};
exports.ValidationService = ValidationService;
exports.ValidationService = ValidationService = ValidationService_1 = __decorate([
    (0, common_1.Injectable)()
], ValidationService);
//# sourceMappingURL=validation.service.js.map