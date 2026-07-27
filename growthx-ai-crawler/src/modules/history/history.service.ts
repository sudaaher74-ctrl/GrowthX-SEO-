import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

export interface IssueSummaryItem {
  issueType: string;
  severity: string;
  affectedUrl: string;
  description: string;
}

export interface CrawlDiffReport {
  currentJobId: string;
  previousJobId: string;
  pageCountDiff: number;
  issuesCountDiff: number;
  newIssues: IssueSummaryItem[];
  resolvedIssues: IssueSummaryItem[];
  recurringIssues: IssueSummaryItem[];
  summaryMessage: string;
}

@Injectable()
export class HistoryService {
  private readonly logger = new Logger(HistoryService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Compares two historical crawl jobs to identify new, resolved, and recurring SEO audit issues.
   */
  async compareCrawlJobs(currentJobId: string, previousJobId: string): Promise<CrawlDiffReport> {
    this.logger.log(`Comparing Crawl Job ${currentJobId} against ${previousJobId}...`);

    const [currJob, prevJob] = await Promise.all([
      this.prisma.crawlJob.findUnique({ where: { id: currentJobId } }),
      this.prisma.crawlJob.findUnique({ where: { id: previousJobId } }),
    ]);

    if (!currJob || !prevJob) {
      throw new NotFoundException('One or both specified crawl jobs were not found');
    }

    const [currIssues, prevIssues] = await Promise.all([
      this.prisma.issue.findMany({ where: { crawlJobId: currentJobId } }),
      this.prisma.issue.findMany({ where: { crawlJobId: previousJobId } }),
    ]);

    // Create lookup keys: issueType:affectedUrl
    const prevMap = new Map<string, any>();
    for (const issue of prevIssues) {
      prevMap.set(`${issue.issueType}:${issue.affectedUrl}`, issue);
    }

    const currMap = new Map<string, any>();
    for (const issue of currIssues) {
      currMap.set(`${issue.issueType}:${issue.affectedUrl}`, issue);
    }

    const newIssues: IssueSummaryItem[] = [];
    const recurringIssues: IssueSummaryItem[] = [];
    const resolvedIssues: IssueSummaryItem[] = [];

    // Detect new and recurring issues
    for (const [key, issue] of currMap.entries()) {
      const item: IssueSummaryItem = {
        issueType: issue.issueType,
        severity: issue.severity,
        affectedUrl: issue.affectedUrl,
        description: issue.description,
      };

      if (prevMap.has(key)) {
        recurringIssues.push(item);
      } else {
        newIssues.push(item);
      }
    }

    // Detect resolved issues
    for (const [key, issue] of prevMap.entries()) {
      if (!currMap.has(key)) {
        resolvedIssues.push({
          issueType: issue.issueType,
          severity: issue.severity,
          affectedUrl: issue.affectedUrl,
          description: issue.description,
        });
      }
    }

    const pageCountDiff = currJob.pagesCrawled - prevJob.pagesCrawled;
    const issuesCountDiff = currIssues.length - prevIssues.length;

    return {
      currentJobId,
      previousJobId,
      pageCountDiff,
      issuesCountDiff,
      newIssues,
      resolvedIssues,
      recurringIssues,
      summaryMessage: `Comparison complete: ${newIssues.length} new issues detected, ${resolvedIssues.length} issues resolved, and ${recurringIssues.length} issues remain open.`,
    };
  }
}
