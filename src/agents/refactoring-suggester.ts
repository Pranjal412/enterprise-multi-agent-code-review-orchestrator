import type { AgentDefinition } from '@anthropic-ai/claude-agent-sdk';
import { REFACTORING_SUGGESTER_PROMPT } from '../prompts';

export const refactoringSuggester: AgentDefinition = {
  description:
    'Identifies actionable refactoring opportunities including extraction, renaming, modernization, simplification, and pattern improvements.',
  prompt: REFACTORING_SUGGESTER_PROMPT,
  model: 'inherit',
  tools: ['Read', 'Glob', 'Grep', 'Skill']
};
