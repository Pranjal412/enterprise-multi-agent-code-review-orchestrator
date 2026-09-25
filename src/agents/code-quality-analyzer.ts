import type { AgentDefinition } from '@anthropic-ai/claude-agent-sdk';
import { CODE_QUALITY_ANALYZER_PROMPT } from '../prompts';

export const codeQualityAnalyzer: AgentDefinition = {
  description:
    'Analyzes code for security vulnerabilities, performance problems, maintainability issues, bug risks, style issues, and best-practice violations.',
  prompt: CODE_QUALITY_ANALYZER_PROMPT,
  model: 'inherit',
  tools: ['Read', 'Glob', 'Grep', 'Skill']
};
