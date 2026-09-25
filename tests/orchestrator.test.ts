import { beforeEach, describe, expect, it, vi } from 'vitest';

const { queryMock } = vi.hoisted(() => ({
  queryMock: vi.fn(),
}));

vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: queryMock,
}));

import { CodeReviewOrchestrator } from '../src/orchestrator';

const validReport = {
  pullRequest: {
    owner: 'octocat',
    repo: 'Hello-World',
    number: 1,
  },
  fileReviews: [
    {
      file: 'src/example.ts',
      codeQuality: {
        file: 'src/example.ts',
        issues: [],
        overallScore: 90,
        summary: 'No significant code-quality issues found.',
      },
      testCoverage: {
        file: 'src/example.ts',
        hasTests: true,
        testFiles: ['tests/example.test.ts'],
        untestedPaths: [],
        coverageEstimate: 90,
        summary: 'Good test coverage.',
      },
      refactorings: {
        file: 'src/example.ts',
        suggestions: [],
        summary: 'No significant refactoring opportunities found.',
      },
    },
  ],
  summary: {
    totalFiles: 1,
    overallScore: 90,
    criticalIssues: 0,
    highPriorityTests: 0,
    refactoringOpportunities: 0,
  },
  recommendations: [],
  metadata: {
    analyzedAt: '2026-09-24T00:00:00.000Z',
    duration: 1000,
    agentVersions: {
      'code-quality-analyzer': '1.0',
      'test-coverage-analyzer': '1.0',
      'refactoring-suggester': '1.0',
    },
  },
};

async function* resultStream(message: unknown) {
  yield message;
}

describe('CodeReviewOrchestrator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ANTHROPIC_MODEL = 'claude-sonnet-4-5-20250929';
  });

  describe('Configuration', () => {
    it('should initialize with the environment model by default', () => {
      const orchestrator = new CodeReviewOrchestrator();

      expect(orchestrator).toBeInstanceOf(CodeReviewOrchestrator);
    });

    it('should accept custom model and options', () => {
      const orchestrator = new CodeReviewOrchestrator({
        model: 'claude-test-model',
        maxTurns: 10,
        permissionMode: 'plan',
      });

      expect(orchestrator).toBeInstanceOf(CodeReviewOrchestrator);
    });

    it('should reject missing model configuration', () => {
      delete process.env.ANTHROPIC_MODEL;

      expect(() => new CodeReviewOrchestrator()).toThrow(
        'ANTHROPIC_MODEL is required'
      );
    });
  });

  describe('reviewPullRequest', () => {
    it('should validate pull request inputs', async () => {
      const orchestrator = new CodeReviewOrchestrator();

      await expect(
        orchestrator.reviewPullRequest('', 'Hello-World', 1)
      ).rejects.toThrow('Repository owner is required.');

      await expect(
        orchestrator.reviewPullRequest('octocat', '', 1)
      ).rejects.toThrow('Repository name is required.');

      await expect(
        orchestrator.reviewPullRequest('octocat', 'Hello-World', 0)
      ).rejects.toThrow('Pull request number must be a positive integer.');
    });

    it('should configure GitHub MCP, ESLint MCP, Task, and all 3 agents', async () => {
      queryMock.mockReturnValue(
        resultStream({
          type: 'result',
          structured_output: validReport,
        })
      );

      const orchestrator = new CodeReviewOrchestrator();

      await orchestrator.reviewPullRequest('octocat', 'Hello-World', 1);

      expect(queryMock).toHaveBeenCalledTimes(1);

      const call = queryMock.mock.calls[0]?.[0];

      expect(call.prompt).toContain('octocat/Hello-World');
      expect(call.prompt).toContain('ALL THREE specialized agents');

      expect(call.options.allowedTools).toEqual(
        expect.arrayContaining([
          'Task',
          'Read',
          'Glob',
          'Grep',
          'Skill',
          'mcp__github__*',
          'mcp__eslint__*',
        ])
      );

      expect(call.options.mcpServers).toHaveProperty('github');
      expect(call.options.mcpServers).toHaveProperty('eslint');

      expect(call.options.agents).toEqual(
        expect.objectContaining({
          'code-quality-analyzer': expect.any(Object),
          'test-coverage-analyzer': expect.any(Object),
          'refactoring-suggester': expect.any(Object),
        })
      );
    });

    it('should aggregate a valid structured output into ReviewReport', async () => {
      queryMock.mockReturnValue(
        resultStream({
          type: 'result',
          structured_output: validReport,
        })
      );

      const orchestrator = new CodeReviewOrchestrator();

      const report = await orchestrator.reviewPullRequest(
        'octocat',
        'Hello-World',
        1
      );

      expect(report.pullRequest).toEqual({
        owner: 'octocat',
        repo: 'Hello-World',
        number: 1,
      });

      expect(report.fileReviews).toHaveLength(1);
      expect(report.fileReviews[0]?.file).toBe('src/example.ts');
      expect(report.summary.totalFiles).toBe(1);
      expect(report.metadata.agentVersions).toHaveProperty(
        'code-quality-analyzer'
      );
    });

    it('should validate structured output with the Zod schema', async () => {
      queryMock.mockReturnValue(
        resultStream({
          type: 'result',
          structured_output: {
            ...validReport,
            summary: {
              ...validReport.summary,
              overallScore: 'invalid',
            },
          },
        })
      );

      const orchestrator = new CodeReviewOrchestrator();

      await expect(
        orchestrator.reviewPullRequest('octocat', 'Hello-World', 1)
      ).rejects.toThrow('Invalid ReviewReport returned by orchestrator');
    });

    it('should fail when no structured output is returned', async () => {
      queryMock.mockReturnValue(
        resultStream({
          type: 'result',
        })
      );

      const orchestrator = new CodeReviewOrchestrator();

      await expect(
        orchestrator.reviewPullRequest('octocat', 'Hello-World', 1)
      ).rejects.toThrow('did not return structured output');
    });

    it('should wrap SDK/query failures with pull request context', async () => {
      async function* failingStream() {
        throw new Error('Mock SDK failure');
      }

      queryMock.mockReturnValue(failingStream());

      const orchestrator = new CodeReviewOrchestrator();

      await expect(
        orchestrator.reviewPullRequest('octocat', 'Hello-World', 1)
      ).rejects.toThrow(
        'Pull request review failed for octocat/Hello-World#1: Mock SDK failure'
      );
    });

    it('should preserve valid metadata and add defaults when needed', async () => {
      const reportWithoutMetadataDefaults = {
        ...validReport,
        metadata: {
          analyzedAt: '',
          duration: 0,
          agentVersions: {},
        },
      };

      queryMock.mockReturnValue(
        resultStream({
          type: 'result',
          structured_output: reportWithoutMetadataDefaults,
        })
      );

      const orchestrator = new CodeReviewOrchestrator();

      const report = await orchestrator.reviewPullRequest(
        'octocat',
        'Hello-World',
        1
      );

      expect(report.metadata.analyzedAt).not.toBe('');
      expect(report.metadata.duration).toBeGreaterThanOrEqual(0);
      expect(report.metadata.agentVersions).toEqual({});
    });
  });

  describe('Integration', () => {
    it.skip('should review a real small PR', async () => {
      // Requires a real API key and should be run manually.
    });
  });
});
