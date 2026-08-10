export declare class StorageService {
    private readonly logger;
    private readonly provider;
    private readonly localPath;
    constructor();
    saveSnapshot(jobId: string, pageId: string, content: string | Buffer, extension?: string): Promise<string>;
    readSnapshot(fileUrl: string): Promise<string | null>;
}
