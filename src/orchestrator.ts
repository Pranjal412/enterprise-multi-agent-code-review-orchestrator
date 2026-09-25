import { query } from '@anthropic-ai/claude-agent-sdk';
import type { AgentDefinition } from '@anthropic-ai/claude-agent-sdk';

import {
  codeQualityAnalyzer,
  testCoverageAnalyzer,
  refactoringSuggester
} from './agents';

import { mcpServersConfig } from './config/mcp.config';
import { buildOrchestratorPrompt } from './prompts';
import {
  ReviewReportSchema,
  ReviewReportJSONSchema,
  type ReviewReport
} from './types';

/**
 * Orchestrator configuration options.
 */
export interface OrchestratorOptions {
  model?: string;
  maxTurns?: number;
  permissionMode?: 'default' | 'acceptEdits' | 'bypassPermissions' | 'plan' | 'dontAsk';
}

/**
 * Main Code Review Orchestrator.
 *
 * Coordinates the three specialized subagents and aggregates their
 * results into a ReviewReport.
 */
export class CodeReviewOrchestrator {
  private readonly model: string;
  private readonly maxTurns: number;
  private readonly permissionMode: OrchestratorOptions['permissionMode'];

  private readonly agents: Record<string, AgentDefinition> = {
    'code-quality-analyzer': codeQualityAnalyzer,
    'test-coverage-analyzer': testCoverageAnalyzer,
    'refactoring-suggester': refactoringSuggester
  };

  constructor(options: OrchestratorOptions = {}) {
    const model = options.model || process.env.ANTHROPIC_MODEL;

    if (!model) {
      throw new Error(
        'ANTHROPIC_MODEL is required. Set it in the environment, for example: ' +
        'claude-sonnet-4-5-20250929'
      );
    }

    this.model = model;
    this.maxTurns = options.maxTurns ?? 30;
    this.permissionMode = options.permissionMode ?? 'dontAsk';
  }

  /**
   * Review a pull request using parallel specialized-agent analysis.
   */
  async reviewPullRequest(
    owner: string,
    repo: string,
    prNumber: number
  ): Promise<ReviewReport> {
    if (!owner.trim()) {
      throw new Error('Repository owner is required.');
    }

    if (!repo.trim()) {
      throw new Error('Repository name is required.');
    }

    if (!Number.isInteger(prNumber) || prNumber <= 0) {
      throw new Error('Pull request number must be a positive integer.');
    }

    const startedAt = Date.now();

    const prompt = buildOrchestratorPrompt(owner, repo, prNumber);

    const result = query({
      prompt,
      options: {
        model: this.model,
        maxTurns: this.maxTurns,
        permissionMode: this.permissionMode,

        // The orchestrator needs Task to explicitly invoke the
        // three specialized subagents.
        allowedTools: [
          'Task',
          'Read',
          'Glob',
          'Grep',
          'Skill',
          'mcp__github__*',
          'mcp__eslint__*'
        ],

        agents: this.agents,

        mcpServers: mcpServersConfig,

        outputFormat: {
          type: 'json_schema',
          schema: ReviewReportJSONSchema
        }
      }
    });

    let structuredOutput: unknown;

    try {
      for await (const message of result) {
        if (
          message.type === 'result' &&
          'structured_output' in message
        ) {
          structuredOutput = message.structured_output;
        }
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error);

      throw new Error(
        `Pull request review failed for ${owner}/${repo}#${prNumber}: ${message}`
      );
    }

    if (structuredOutput === undefined) {
      throw new Error(
        `The orchestrator did not return structured output for ${owner}/${repo}#${prNumber}.`
      );
    }

    const parsed = ReviewReportSchema.safeParse(structuredOutput);

    if (!parsed.success) {
      throw new Error(
        `Invalid ReviewReport returned by orchestrator: ${parsed.error.message}`
      );
    }

    const report = parsed.data;

    // Ensure metadata reflects this orchestration run even if the model
    // returned incomplete metadata.
    report.metadata = {
      ...report.metadata,
      analyzedAt:
        report.metadata?.analyzedAt || new Date().toISOString(),
      duration:
        report.metadata?.duration || Date.now() - startedAt,
      agentVersions:
        report.metadata?.agentVersions || {
          'code-quality-analyzer': '1.0',
          'test-coverage-analyzer': '1.0',
          'refactoring-suggester': '1.0'
        }
    };

    return report;
  }
}
