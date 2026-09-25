import * as dotenv from 'dotenv';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

import { CodeReviewOrchestrator } from './orchestrator.js';
import { ReportGenerator } from './utils/report-generator.js';
import { formatError, ReviewError, ErrorCodes } from './utils/error-handler.js';

// Load environment variables.
dotenv.config();

/**
 * Main entry point for the Claude Multi-Agent Code Review System.
 *
 * Usage:
 *   npm run dev -- <owner> <repo> <pr-number>
 */
async function main(): Promise<void> {
  const [owner, repo, prStr] = process.argv.slice(2);

  // ------------------------------------------------------------
  // Validate command-line arguments
  // ------------------------------------------------------------
  if (!owner || !repo || !prStr) {
    console.error(
      'Usage: npm run dev -- <owner> <repo> <pr-number>'
    );
    process.exitCode = 1;
    return;
  }

  const prNumber = Number(prStr);

  if (
    !Number.isInteger(prNumber) ||
    prNumber <= 0
  ) {
    console.error(
      `Invalid pull request number: "${prStr}". ` +
      'The PR number must be a positive integer.'
    );
    process.exitCode = 1;
    return;
  }

  // ------------------------------------------------------------
  // Validate authentication
  // ------------------------------------------------------------
  const hasAnthropicApiKey =
    Boolean(process.env.ANTHROPIC_API_KEY);

  const hasAwsCredentials =
    Boolean(process.env.AWS_ACCESS_KEY_ID) &&
    Boolean(process.env.AWS_SECRET_ACCESS_KEY);

  if (hasAnthropicApiKey) {
    console.log('🔐 Using Anthropic API authentication');
  } else if (hasAwsCredentials) {
    if (!process.env.AWS_REGION) {
      console.error(
        'AWS authentication was detected, but AWS_REGION is not set.'
      );
      process.exitCode = 1;
      return;
    }

    console.log('🔐 Using AWS Bedrock authentication');
  } else {
    console.error(
      'No Claude authentication configured.\n\n' +
      'Configure one of the following:\n' +
      '  1. ANTHROPIC_API_KEY\n' +
      '  2. AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY + AWS_REGION'
    );
    process.exitCode = 1;
    return;
  }

  // ------------------------------------------------------------
  // Validate model configuration
  // ------------------------------------------------------------
  const model = process.env.ANTHROPIC_MODEL?.trim();

  const githubToken = process.env.GITHUB_TOKEN?.trim();

  if (!githubToken) {
    console.error(
      'GITHUB_TOKEN is required for GitHub MCP integration.\n\n' +
      'Create a GitHub personal access token with repository read access, then add it to your .env file:\n' +
      '  GITHUB_TOKEN=ghp_your-token-here'
    );
    process.exitCode = 1;
    return;
  }

  if (!model) {
    console.error(
      'ANTHROPIC_MODEL is required.\n\n' +
      'Examples:\n' +
      '  Anthropic API: claude-sonnet-4-5-20250929\n' +
      '  AWS Bedrock:  us.anthropic.claude-sonnet-4-5-20250929-v1:0'
    );
    process.exitCode = 1;
    return;
  }

  // Basic format validation based on the assignment's two supported forms.
  const isAnthropicModel =
    /^claude-[a-z0-9-]+-\d{8}$/.test(model);

  const isBedrockModel =
    /^us\.anthropic\.[a-z0-9.-]+-v\d+:\d+$/.test(model);

  if (!isAnthropicModel && !isBedrockModel) {
    console.error(
      `Invalid ANTHROPIC_MODEL: "${model}".\n\n` +
      'Expected examples:\n' +
      '  Anthropic API: claude-sonnet-4-5-20250929\n' +
      '  AWS Bedrock:  us.anthropic.claude-sonnet-4-5-20250929-v1:0'
    );
    process.exitCode = 1;
    return;
  }

  console.log(`🤖 Model: ${model}`);
  console.log(`🔎 Reviewing ${owner}/${repo}#${prNumber}`);

  try {
    // ----------------------------------------------------------
    // Create orchestrator
    // ----------------------------------------------------------
    const orchestrator = new CodeReviewOrchestrator({
      model,
      maxTurns: 30,
      permissionMode: 'dontAsk'
    });

    // ----------------------------------------------------------
    // Run the multi-agent review
    // ----------------------------------------------------------
    const report = await orchestrator.reviewPullRequest(
      owner,
      repo,
      prNumber
    );

    // ----------------------------------------------------------
    // Generate reports
    // ----------------------------------------------------------
    const reportGenerator = new ReportGenerator();

    const markdown = reportGenerator.generateMarkdownReport(report);
    const html = reportGenerator.generateHTMLReport(report);
    const json = reportGenerator.generateJSONReport(report);

    const reportsDirectory = path.resolve(
      process.cwd(),
      'reports'
    );

    await fs.mkdir(reportsDirectory, { recursive: true });

    const jsonPath = path.join(reportsDirectory, 'report.json');
    const markdownPath = path.join(reportsDirectory, 'report.md');
    const htmlPath = path.join(reportsDirectory, 'report.html');

    await Promise.all([
      fs.writeFile(jsonPath, json, 'utf8'),
      fs.writeFile(markdownPath, markdown, 'utf8'),
      fs.writeFile(htmlPath, html, 'utf8')
    ]);

    console.log('');
    console.log('✅ Review completed successfully');
    console.log(`📄 JSON: ${jsonPath}`);
    console.log(`📝 Markdown: ${markdownPath}`);
    console.log(`🌐 HTML: ${htmlPath}`);
  } catch (error) {
    const formatted = formatError(error);

    console.error('');
    console.error(`❌ Review failed: ${formatted}`);

    if (error instanceof ReviewError) {
      console.error(`Error code: ${error.code}`);
    }

    if (error instanceof Error && error.stack) {
      console.error(error.stack);
    }

    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  console.error(
    '❌ Unexpected application error:',
    formatError(error)
  );

  process.exitCode = 1;
});
