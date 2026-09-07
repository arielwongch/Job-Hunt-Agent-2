import { readFile } from "node:fs/promises";
import { searchWeb } from "./webSearch.js";

const TOOLS = [
  {
    type: "function",
    function: {
      name: "search_web",
      description: "Search the public web for factual company, role, product, or technology context.",
      parameters: {
        type: "object",
        properties: { query: { type: "string" }, limit: { type: "integer", minimum: 1, maximum: 5 } },
        required: ["query"]
      }
    }
  }
];

export async function runReactTailor({ client, store, jobDescription, templatePath, maxSteps = 6 }) {
  const editableExperiences = await store.search(jobDescription, { includeLocked: false, limit: 12 });
  const lockedRecords = (await store.list()).filter((item) => item.locked);
  const template = await readFile(templatePath, "utf8");
  const messages = [
    {
      role: "system",
      content: `You are a CV tailoring agent. Work in a bounded ReAct loop: reason privately, use search_web only when external context is missing, and then produce the final answer. The final answer must be a complete compilable LaTeX document based on the supplied template. Preserve the template's commands and structure where possible. Use only truthful claims supported by the experiences; do not invent metrics, employers, dates, or qualifications. Locked records must be copied exactly and never rewritten. Return only LaTeX in the final answer, with no Markdown fences.`
    },
    {
      role: "user",
      content: JSON.stringify({ jobDescription, relevantEditableExperiences: editableExperiences, lockedRecords, template }, null, 2)
    }
  ];

  for (let step = 0; step < maxSteps; step += 1) {
    const message = await client.chat(messages, TOOLS);
    if (!message) throw new Error("OpenRouter returned an empty response");
    messages.push(message);

    if (!message.tool_calls?.length) {
      const latex = stripMarkdownFence(message.content || "");
      if (!latex.includes("\\documentclass") || !latex.includes("\\end{document}")) {
        throw new Error("The tailoring agent did not return a complete LaTeX document");
      }
      return { latex, steps: step + 1, editableExperiences, lockedRecords };
    }

    for (const toolCall of message.tool_calls) {
      if (toolCall.function?.name !== "search_web") {
        messages.push({ role: "tool", tool_call_id: toolCall.id, content: JSON.stringify({ error: "Unknown tool" }) });
        continue;
      }
      try {
        const args = JSON.parse(toolCall.function.arguments || "{}");
        const results = await searchWeb(args.query, args.limit || 5);
        messages.push({ role: "tool", tool_call_id: toolCall.id, content: JSON.stringify(results) });
      } catch (error) {
        messages.push({ role: "tool", tool_call_id: toolCall.id, content: JSON.stringify({ error: error.message }) });
      }
    }
  }

  throw new Error(`ReAct loop exceeded ${maxSteps} steps without producing LaTeX`);
}

function stripMarkdownFence(value) {
  return value.replace(/^```(?:latex|tex)?\s*/i, "").replace(/\s*```$/i, "").trim();
}
