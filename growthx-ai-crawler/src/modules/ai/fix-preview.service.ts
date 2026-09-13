import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { SecurityService } from '../security/security.service';
import { AutoFixService } from './auto-fix.service';
import {
  candidatePaths,
  FixBefore,
  FixLocation,
  FixPreview,
  SCHEMA_FIXES,
  SURFACE,
  SURFACE_NOTE,
} from './fix-preview.util';

export type { FixBefore, FixLocation, FixPreview, FixSurface } from './fix-preview.util';

/**
 * Everything the fix modal needs to show a real before and after.
 *
 * The modal used to render both sides from hardcoded templates: the "current
 * state" was a fixed comment describing the problem category, and the "fixed
 * code" was a template with the domain interpolated — which is why a
 * SCHEMA_PRODUCT_OFFERS defect was answered with a generic WebPage schema, and
 * why nobody could find where the change was supposed to go.
 *
 * Everything here comes from something real: the before is what the crawler
 * actually found on the page, the after is `AutoFixService`'s patch written
 * from the customer's own content, and the file path is looked up in the
 * connected repository. Where a value cannot be established it is null with a
 * note saying so, rather than filled in with a plausible-looking default.
 */

@Injectable()
export class FixPreviewService {
  private readonly logger = new Logger(FixPreviewService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly security: SecurityService,
    private readonly autoFix: AutoFixService,
  ) {}

  async buildPreview(issueId: string, organizationId?: string): Promise<FixPreview> {
    const issue = await this.prisma.issue.findUnique({
      where: { id: issueId },
      include: {
        page: { include: { schemas: true, crawlJob: { include: { website: true } } } },
      },
    });

    if (!issue?.page) {
      throw new NotFoundException(`Issue or associated page not found for ID ${issueId}`);
    }

    const patch = await this.autoFix.generateFixPatch(issueId, organizationId);
    const surface = SURFACE[patch.fixType] ?? 'METADATA';
    const isSchemaFix = SCHEMA_FIXES.includes(patch.fixType);

    const projectId = issue.page.crawlJob?.website?.projectId ?? null;
    const location = await this.resolveLocation(projectId, issue.affectedUrl);

    return {
      fixType: patch.fixType,
      issueType: issue.issueType,
      targetUrl: patch.targetUrl,
      before: this.buildBefore(patch.originalValue ?? null, issue.page.schemas, isSchemaFix),
      after: {
        proposedValue: patch.proposedValue,
        codeSnippet: patch.codeSnippet,
        source: patch.source,
        model: patch.model,
      },
      location,
      surface,
      surfaceNote: SURFACE_NOTE[surface],
      // Only schema has a public checker that can confirm the change landed.
      validatorUrl: isSchemaFix
        ? `https://search.google.com/test/rich-results?url=${encodeURIComponent(issue.affectedUrl)}`
        : null,
    };
  }

  /**
   * What the page carries today.
   *
   * For a schema fix this is every JSON-LD block the crawler parsed, which is
   * the honest answer to "what do I have now" — including the common case of
   * none at all, which is stated rather than shown as an empty box.
   */
  private buildBefore(
    originalValue: string | null,
    schemas: Array<{ schemaType: string; isValid: boolean; rawJson: string | null }>,
    isSchemaFix: boolean,
  ): FixBefore {
    if (!isSchemaFix) {
      return {
        value: originalValue,
        existingSchemas: [],
        note: originalValue
          ? 'This is the value currently on the page.'
          : 'This page has no such value today, so the fix adds one rather than replacing it.',
      };
    }

    const existing = schemas.map((s) => ({
      schemaType: String(s.schemaType),
      isValid: s.isValid,
      rawJson: s.rawJson,
    }));

    const invalid = existing.filter((s) => !s.isValid).length;

    return {
      value: null,
      existingSchemas: existing,
      note: existing.length === 0
        ? 'The crawler found no structured data on this page.'
        : invalid > 0
          ? `${existing.length} structured data block(s) found, ${invalid} of which failed validation.`
          : `${existing.length} structured data block(s) already on this page.`,
    };
  }

  /**
   * Find the file to edit in the connected repository.
   *
   * A single tree read rather than a clone: this runs every time the modal
   * opens, and cloning a customer's repository to answer "which file" would
   * take minutes. When no repository is connected, or the read fails, the
   * candidates are still returned — marked `derived`, so the UI can say the
   * path is inferred from the URL instead of presenting a guess as fact.
   */
  private async resolveLocation(
    projectId: string | null,
    url: string,
  ): Promise<FixLocation> {
    const candidates = candidatePaths(url);

    if (!projectId) {
      return {
        path: null,
        source: 'derived',
        candidates,
        note: 'This page is not linked to a project, so no repository could be checked.',
      };
    }

    const repo = await this.prisma.siteRepository.findUnique({ where: { projectId } });
    if (!repo) {
      return {
        path: null,
        source: 'derived',
        candidates,
        note: 'No repository is connected to this project, so these paths are inferred from the URL.',
      };
    }

    try {
      // Loaded on demand, not at module scope. `@octokit/rest` is ESM-only,
      // and a static import here puts it in the import graph of every module
      // that reaches this service — which includes CrawlController, whose
      // specs then fail to load at all under this project's jest transform.
      // Deferring it also means the cost is only paid when a repository is
      // actually connected.
      const { Octokit } = await import('@octokit/rest');
      const octokit = new Octokit({
        auth: this.security.decryptCredentials(repo.accessTokenEncrypted),
      });
      const tree = await octokit.git.getTree({
        owner: repo.owner,
        repo: repo.name,
        tree_sha: repo.defaultBranch,
        recursive: 'true',
      });

      const present = new Set(
        tree.data.tree
          .filter((entry) => entry.type === 'blob' && entry.path)
          .map((entry) => entry.path as string),
      );

      // Longest match first: `src/app/products/tomato/page.tsx` is a better
      // answer than a bare `products/tomato.html` that also happens to exist.
      const found = candidates.find((candidate) => present.has(candidate)) ?? null;

      return {
        path: found,
        source: found ? 'repository' : 'derived',
        candidates,
        note: found
          ? `Confirmed in ${repo.owner}/${repo.name} on ${repo.defaultBranch}.`
          : `None of these paths exist in ${repo.owner}/${repo.name}. The page may be generated from a template or a CMS.`,
      };
    } catch (error) {
      this.logger.warn(
        `Could not read the repository tree for project ${projectId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return {
        path: null,
        source: 'derived',
        candidates,
        note: 'The connected repository could not be read, so these paths are inferred from the URL.',
      };
    }
  }
}
