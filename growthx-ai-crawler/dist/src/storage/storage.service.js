"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var StorageService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.StorageService = void 0;
const common_1 = require("@nestjs/common");
const fs = require("fs");
const path = require("path");
let StorageService = StorageService_1 = class StorageService {
    constructor() {
        this.logger = new common_1.Logger(StorageService_1.name);
        this.provider = process.env.STORAGE_PROVIDER || 'local';
        this.localPath = process.env.LOCAL_STORAGE_PATH || './storage/snapshots';
        if (this.provider === 'local') {
            try {
                if (!fs.existsSync(this.localPath)) {
                    fs.mkdirSync(this.localPath, { recursive: true });
                }
            }
            catch (err) {
                this.logger.warn(`Could not create local storage dir ${this.localPath}`, err);
            }
        }
    }
    async saveSnapshot(jobId, pageId, content, extension = 'html') {
        const filename = `${jobId}_${pageId}_${Date.now()}.${extension}`;
        if (this.provider === 's3' && process.env.AWS_S3_BUCKET) {
            // In a real S3 deployment, we would use S3Client from @aws-sdk/client-s3
            this.logger.log(`Uploading ${filename} to AWS S3 bucket ${process.env.AWS_S3_BUCKET}`);
            return `https://${process.env.AWS_S3_BUCKET}.s3.amazonaws.com/snapshots/${filename}`;
        }
        // Default local filesystem storage
        const targetPath = path.resolve(this.localPath, filename);
        try {
            await fs.promises.writeFile(targetPath, content);
            return `file://${targetPath}`;
        }
        catch (error) {
            this.logger.error(`Failed to write snapshot locally at ${targetPath}`, error);
            return `error://storage-failure/${filename}`;
        }
    }
    async readSnapshot(fileUrl) {
        if (fileUrl.startsWith('file://')) {
            const filePath = fileUrl.replace('file://', '');
            try {
                return await fs.promises.readFile(filePath, 'utf-8');
            }
            catch (err) {
                this.logger.error(`Failed to read local snapshot from ${filePath}`, err);
                return null;
            }
        }
        return null;
    }
};
exports.StorageService = StorageService;
exports.StorageService = StorageService = StorageService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], StorageService);
//# sourceMappingURL=storage.service.js.map