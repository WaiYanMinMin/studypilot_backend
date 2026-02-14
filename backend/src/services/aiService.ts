import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

import type {
  AskResponse,
  Citation,
  QuizQuestion,
  StudyResourcesResponse
} from "../types";

function getClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is missing. Add it to your environment.");
  }
  return new OpenAI({ apiKey });
}

function formatCitations(citations: Citation[]) {
  return citations
    .map(
      (c, idx) =>
        `[${idx + 1}] ${c.title} (page ${c.pageNumber}, ${c.chunkId}): ${c.excerpt}`
    )
    .join("\n");
}

function extractChatText(
  message:
    | { content?: string | Array<{ type?: string; text?: string }> | null }
    | undefined
) {
  if (!message?.content) return "";
  if (typeof message.content === "string") return message.content.trim();
  return message.content
    .map((part) => (part.type === "text" ? part.text || "" : ""))
    .join("")
    .trim();
}

export async function answerQuestionWithCitations(params: {
  question: string;
  citations: Citation[];
  highlightText?: string;
}): Promise<AskResponse> {
  const { question, citations, highlightText } = params;

  const client = getClient();
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

  const highlightContext = highlightText
    ? `Highlighted text (highest priority context):\n${highlightText}\n\n`
    : "";

  const prompt = `${highlightContext}Question: ${question}\n\nReference chunks:\n${formatCitations(
    citations
  )}\n\nInstructions:
- Answer only using grounded information from the references.
- If uncertain, explicitly say what is missing.
- Provide a concise, student-friendly explanation.
- End with a short citation list like [1], [2].`;

  const messages: ChatCompletionMessageParam[] = [
    {
      role: "system",
      content:
        "You are a careful study assistant. Do not fabricate facts not present in provided references."
    },
    { role: "user", content: prompt }
  ];

  const completion = await client.chat.completions.create({
    model,
    messages
  });

  const answer =
    extractChatText(completion.choices[0]?.message) || "No answer generated.";
  return { answer, citations };
}

export async function generateStudyResources(params: {
  lectureText: string;
}): Promise<StudyResourcesResponse> {
  const client = getClient();
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

  const messages: ChatCompletionMessageParam[] = [
    {
      role: "system",
      content:
        "You are a study resource generator. Return concise and exam-focused output."
    },
    {
      role: "user",
      content: `Generate three outputs from this lecture material:
1) Summary (6-10 bullets)
2) Cheat sheet (key formulas, definitions, and frameworks)
3) Quiz (10 multiple-choice questions only)

Cheat sheet formatting rules (strict):
- Use Markdown headings and bullets for readability.
- Any mathematical expression must be valid LaTeX.
- Inline math must be wrapped with single dollar delimiters: $...$.
- Standalone equations must be wrapped with double dollar delimiters: $$...$$.
- Never wrap equations as plain text with parentheses like ( equation ) without $ delimiters.
- Preserve symbols and indices in proper LaTeX form (example: $X_{\\text{std}}$).

Format your response exactly as:
<summary>
...content...
</summary>
<cheatsheet>
...content...
</cheatsheet>
<quiz_json>
[
  {
    "id": "q1",
    "prompt": "Question text",
    "options": ["A", "B", "C", "D"],
    "correctOptionIndex": 1,
    "explanation": "Why this answer is correct"
  }
]
</quiz_json>

Lecture material:
${params.lectureText.slice(0, 20000)}`
    }
  ];

  const completion = await client.chat.completions.create({
    model,
    messages
  });

  const output = extractChatText(completion.choices[0]?.message);
  const summary = output.match(/<summary>([\s\S]*?)<\/summary>/i)?.[1]?.trim();
  const cheatSheet = output
    .match(/<cheatsheet>([\s\S]*?)<\/cheatsheet>/i)?.[1]
    ?.trim();
  const quizRaw = output.match(/<quiz_json>([\s\S]*?)<\/quiz_json>/i)?.[1]?.trim();

  let quiz: QuizQuestion[] = [];
  if (quizRaw) {
    try {
      const parsed = JSON.parse(quizRaw) as QuizQuestion[];
      quiz = parsed
        .filter(
          (q) =>
            typeof q.id === "string" &&
            typeof q.prompt === "string" &&
            Array.isArray(q.options) &&
            typeof q.correctOptionIndex === "number" &&
            typeof q.explanation === "string"
        )
        .map((q) => ({
          ...q,
          options: q.options.slice(0, 4),
          correctOptionIndex: Math.max(0, Math.min(q.correctOptionIndex, 3))
        }));
    } catch {
      quiz = [];
    }
  }

  return {
    summary: summary || "No summary generated.",
    cheatSheet: cheatSheet || "No cheat sheet generated.",
    quiz
  };
}
