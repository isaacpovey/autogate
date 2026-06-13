import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';
import { ALL_TOOLS, createToolset, type ToolName, type Toolset } from '@autogate/agent-sdk';
import type { AgentSdk, PullRequest } from '@autogate/contracts';

/**
 * The real `AgentSdk` adapter over the Claude Messages API — the production
 * counterpart to the canned `mockAgent`. An agent's PR has no diff blob; the
 * changed files live in the sandbox checkout. So `run` works in two phases:
 *   1. an agentic tool-use loop where Claude inspects the checkout via the
 *      agent's allowlisted read/grep/list/memory tools, and
 *   2. a structured-extraction call (`messages.parse` + `zodOutputFormat`) that
 *      forces the final answer to match the agent's own Zod output schema.
 * Returns the parsed, schema-validated structured output the factory maps to a Verdict.
 */
type ClaudeAgentSdkDeps = {
  apiKey: string;
  model?: string;
  maxToolRounds?: number;
};

const DEFAULT_MODEL = 'claude-opus-4-8';
const DEFAULT_MAX_TOOL_ROUNDS = 6;
const FINAL_INSTRUCTION =
  'Now output your final verdict as structured JSON matching the required schema. Base it strictly on what you found while investigating above — do not introduce new claims.';

/** Anthropic tool names must match ^[a-zA-Z0-9_-]+$, so `memory.x` becomes `memory_x`. */
const anthropicToolName = ({ tool }: { tool: ToolName }): string => tool.replace('.', '_');

const repoToolDefinition = ({ tool }: { tool: ToolName }): Anthropic.Tool => {
  const name = anthropicToolName({ tool });
  switch (tool) {
    case 'read':
      return {
        name,
        description: 'Read a file from the PR checkout by repo-relative path.',
        input_schema: {
          type: 'object',
          properties: { path: { type: 'string', description: 'Repo-relative file path.' } },
          required: ['path'],
        },
      };
    case 'grep':
      return {
        name,
        description: 'Regex-search the checkout. Optionally restrict to include globs.',
        input_schema: {
          type: 'object',
          properties: {
            pattern: { type: 'string' },
            include: { type: 'array', items: { type: 'string' } },
          },
          required: ['pattern'],
        },
      };
    case 'list':
      return {
        name,
        description: 'List files under a directory in the checkout.',
        input_schema: {
          type: 'object',
          properties: { dir: { type: 'string' } },
          required: ['dir'],
        },
      };
    default:
      return {
        name,
        description: `Semantic search of the "${tool.replace('memory.', '')}" memory collection for relevant prior context.`,
        input_schema: {
          type: 'object',
          properties: { text: { type: 'string' }, limit: { type: 'number' } },
          required: ['text'],
        },
      };
  }
};

const readInput = z.object({ path: z.string() });
const grepInput = z.object({ pattern: z.string(), include: z.array(z.string()).optional() });
const listInput = z.object({ dir: z.string() });
const memoryInput = z.object({ text: z.string(), limit: z.number().optional() });

const runRepoTool =
  ({ toolset }: { toolset: Toolset }) =>
  async ({ tool, input }: { tool: ToolName; input: unknown }): Promise<string> => {
    switch (tool) {
      case 'read':
        return toolset.read(readInput.parse(input));
      case 'grep':
        return JSON.stringify(await toolset.grep(grepInput.parse(input)));
      case 'list':
        return JSON.stringify(await toolset.list(listInput.parse(input)));
      default:
        return JSON.stringify(await toolset[tool](memoryInput.parse(input)));
    }
  };

const renderTask = ({ pr }: { pr: PullRequest }): string =>
  [
    `Review pull request #${pr.number} "${pr.title}" on ${pr.repo} (${pr.headRef} → ${pr.baseRef}), authored by ${pr.author}.`,
    '',
    'Description:',
    pr.description.length > 0 ? pr.description : '(no description provided)',
    '',
    'The changed files are in the checkout. Use your read/grep/list tools to inspect them, and any memory tools to retrieve relevant prior context, before forming a judgement. Investigate first — do not guess. When you have gathered enough evidence, stop calling tools and say so.',
  ].join('\n');

const isToolUse = (block: Anthropic.ContentBlock): block is Anthropic.ToolUseBlock =>
  block.type === 'tool_use';

const investigate =
  ({
    client,
    model,
    system,
    tools,
    runTool,
    allow,
  }: {
    client: Anthropic;
    model: string;
    system: string;
    tools: Anthropic.Tool[];
    runTool: (args: { tool: ToolName; input: unknown }) => Promise<string>;
    allow: ToolName[];
  }) =>
  async ({
    messages,
    rounds,
  }: {
    messages: Anthropic.MessageParam[];
    rounds: number;
  }): Promise<Anthropic.MessageParam[]> => {
    if (rounds <= 0) {
      return messages;
    }
    const response = await client.messages.create({
      model,
      max_tokens: 12000,
      thinking: { type: 'adaptive' },
      system,
      tools,
      messages,
    });
    const withAssistant: Anthropic.MessageParam[] = [
      ...messages,
      { role: 'assistant', content: response.content },
    ];
    const toolUses = response.content.filter(isToolUse);
    if (toolUses.length === 0) {
      return withAssistant;
    }
    const results = await Promise.all(
      toolUses.map(async (block): Promise<Anthropic.ToolResultBlockParam> => {
        const tool = allow.find((candidate) => anthropicToolName({ tool: candidate }) === block.name);
        if (tool === undefined) {
          return { type: 'tool_result', tool_use_id: block.id, content: `Unknown tool ${block.name}`, is_error: true };
        }
        try {
          return { type: 'tool_result', tool_use_id: block.id, content: await runTool({ tool, input: block.input }) };
        } catch (error) {
          const detail = error instanceof Error ? error.message : String(error);
          return { type: 'tool_result', tool_use_id: block.id, content: `Tool error: ${detail}`, is_error: true };
        }
      }),
    );
    return investigate({ client, model, system, tools, runTool, allow })({
      messages: [...withAssistant, { role: 'user', content: results }],
      rounds: rounds - 1,
    });
  };

export const createClaudeAgentSdk = ({
  apiKey,
  model = DEFAULT_MODEL,
  maxToolRounds = DEFAULT_MAX_TOOL_ROUNDS,
}: ClaudeAgentSdkDeps): AgentSdk => {
  const client = new Anthropic({ apiKey });
  return {
    run: async ({ instructions, tools, outputSchema, context }) => {
      const allow = ALL_TOOLS.filter((tool) => tools.includes(tool));
      const toolset = createToolset({ allow, context });
      const runTool = runRepoTool({ toolset });
      const toolDefs = allow.map((tool) => repoToolDefinition({ tool }));
      const investigated = await investigate({
        client,
        model,
        system: instructions,
        tools: toolDefs,
        runTool,
        allow,
      })({ messages: [{ role: 'user', content: renderTask({ pr: context.pr }) }], rounds: maxToolRounds });

      const extraction = await client.messages.parse({
        model,
        max_tokens: 8000,
        thinking: { type: 'adaptive' },
        system: instructions,
        messages: [...investigated, { role: 'user', content: FINAL_INSTRUCTION }],
        output_config: { format: zodOutputFormat(outputSchema) },
      });
      return outputSchema.parse(extraction.parsed_output);
    },
  };
};
