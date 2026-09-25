import { describe, expect, it } from 'vitest';
import {
  CodeQualityResultSchema,
  CodeQualityResultJSONSchema,
  TestCoverageResultSchema,
  TestCoverageResultJSONSchema,
  RefactoringSuggestionSchema,
  RefactoringSuggestionJSONSchema,
} from '../src/types';

describe('CodeQualityResultSchema', () => {
  it('accepts a valid result', () => {
    const result = CodeQualityResultSchema.safeParse({
      file: 'src/example.ts',
      issues: [
        {
          line: 10,
          severity: 'high',
          category: 'security',
          description: 'Potential security issue',
          suggestion: 'Validate the input before using it',
        },
      ],
      overallScore: 85,
      summary: 'Generally good code with one security concern.',
    });

    expect(result.success).toBe(true);
  });

  it('rejects invalid severity and score', () => {
    const result = CodeQualityResultSchema.safeParse({
      file: 'src/example.ts',
      issues: [
        {
          line: 10,
          severity: 'invalid',
          category: 'security',
          description: 'Issue',
          suggestion: 'Fix it',
        },
      ],
      overallScore: 120,
      summary: 'Invalid result',
    });

    expect(result.success).toBe(false);
  });

  it('accepts an empty issue list and boundary score', () => {
    const result = CodeQualityResultSchema.safeParse({
      file: 'src/example.ts',
      issues: [],
      overallScore: 0,
      summary: 'No issues found.',
    });

    expect(result.success).toBe(true);
  });
});

describe('TestCoverageResultSchema', () => {
  it('accepts a valid result', () => {
    const result = TestCoverageResultSchema.safeParse({
      file: 'src/example.ts',
      hasTests: true,
      testFiles: ['tests/example.test.ts'],
      untestedPaths: [
        {
          type: 'branch',
          location: 'line 25',
          priority: 'high',
          reasoning: 'Error branch is not covered.',
          suggestedTest: 'Add a test for the error condition.',
        },
      ],
      coverageEstimate: 80,
      summary: 'Most important paths are covered.',
    });

    expect(result.success).toBe(true);
  });

  it('rejects invalid path type and coverage', () => {
    const result = TestCoverageResultSchema.safeParse({
      file: 'src/example.ts',
      hasTests: false,
      testFiles: [],
      untestedPaths: [
        {
          type: 'invalid',
          location: 'line 1',
          priority: 'high',
          reasoning: 'Missing coverage.',
          suggestedTest: 'Add a test.',
        },
      ],
      coverageEstimate: 150,
      summary: 'Invalid result',
    });

    expect(result.success).toBe(false);
  });

  it('accepts zero coverage with no tests', () => {
    const result = TestCoverageResultSchema.safeParse({
      file: 'src/example.ts',
      hasTests: false,
      testFiles: [],
      untestedPaths: [],
      coverageEstimate: 0,
      summary: 'No tests exist.',
    });

    expect(result.success).toBe(true);
  });
});

describe('RefactoringSuggestionSchema', () => {
  it('accepts a valid result', () => {
    const result = RefactoringSuggestionSchema.safeParse({
      file: 'src/example.ts',
      suggestions: [
        {
          type: 'extract-function',
          location: 'lines 10-30',
          impact: 'medium',
          description: 'Extract repeated logic into a helper.',
          before: 'Large inline implementation',
          after: 'Reusable helper function',
          benefits: 'Improves readability and reuse.',
        },
      ],
      summary: 'One useful refactoring opportunity identified.',
    });

    expect(result.success).toBe(true);
  });

  it('rejects invalid suggestion type and impact', () => {
    const result = RefactoringSuggestionSchema.safeParse({
      file: 'src/example.ts',
      suggestions: [
        {
          type: 'invalid',
          location: 'line 10',
          impact: 'critical',
          description: 'Invalid suggestion',
          before: 'Before',
          after: 'After',
          benefits: 'Benefits',
        },
      ],
      summary: 'Invalid result',
    });

    expect(result.success).toBe(false);
  });

  it('accepts an empty suggestions list', () => {
    const result = RefactoringSuggestionSchema.safeParse({
      file: 'src/example.ts',
      suggestions: [],
      summary: 'No refactoring opportunities identified.',
    });

    expect(result.success).toBe(true);
  });
});

describe('JSON schema exports', () => {
  it('exports JSON schemas for all analysis results', () => {
    expect(CodeQualityResultJSONSchema).toBeDefined();
    expect(TestCoverageResultJSONSchema).toBeDefined();
    expect(RefactoringSuggestionJSONSchema).toBeDefined();

    expect(CodeQualityResultJSONSchema).toHaveProperty('type');
    expect(TestCoverageResultJSONSchema).toHaveProperty('type');
    expect(RefactoringSuggestionJSONSchema).toHaveProperty('type');
  });
});
