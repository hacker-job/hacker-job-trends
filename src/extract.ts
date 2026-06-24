/**
 * Shared LLM extraction: turn a raw HN job comment into structured fields.
 * Used by `update` and `backfill`.
 *
 * The endpoint/model are env-configurable so the same code can run against a
 * local LM Studio server (default) or a hosted API in CI:
 *   LLM_BASE_URL, LLM_API_KEY, LLM_MODEL
 */
import OpenAI from "openai";

const PROMPT = `Extract structured job info from this HN job post. Return JSON only:
{
  "company": string,
  "roles": string[],
  "location": string | null,
  "remote_type": "remote" | "onsite" | "hybrid" | null,
  "remote_regions": string[] | null,  // e.g. ["Worldwide"], ["USA"], ["EU", "UK"], null if not remote
  "salary_min": number | null,
  "salary_max": number | null,
  "salary_currency": "USD" | "EUR" | "GBP" | null,
  "tech_stack": string[],
  "job_type": "full-time" | "part-time" | "contract" | "intern" | null,
  "visa": boolean | null
}

Job post:
`;

const client = new OpenAI({
  baseURL: process.env.LLM_BASE_URL || "http://127.0.0.1:1234/v1",
  apiKey: process.env.LLM_API_KEY || "lm-studio",
});
const MODEL = process.env.LLM_MODEL || "google/gemma-4-12b-qat";

export interface JobInfo {
  company?: string;
  roles?: string[];
  location?: string | null;
  remote_type?: string | null;
  remote_regions?: string[] | null;
  salary_min?: number | null;
  salary_max?: number | null;
  salary_currency?: string | null;
  tech_stack?: string[];
  job_type?: string | null;
  visa?: boolean | null;
}

// `text` should already be cleaned (see store.cleanText).
export async function extractJob(text: string): Promise<JobInfo> {
  const res = await client.chat.completions.create({
    model: MODEL,
    messages: [{ role: "user", content: PROMPT + text.slice(0, 800) }],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "job_info",
        schema: {
          type: "object",
          properties: {
            company:         { type: "string" },
            roles:           { type: "array", items: { type: "string" } },
            location:        { type: ["string", "null"] },
            remote_type:     { type: ["string", "null"], enum: ["remote", "onsite", "hybrid", null] },
            remote_regions:  { type: ["array", "null"], items: { type: "string" } },
            salary_min:      { type: ["number", "null"] },
            salary_max:      { type: ["number", "null"] },
            salary_currency: { type: ["string", "null"], enum: ["USD", "EUR", "GBP", null] },
            tech_stack:      { type: "array", items: { type: "string" } },
            job_type:        { type: ["string", "null"], enum: ["full-time", "part-time", "contract", "intern", null] },
            visa:            { type: ["boolean", "null"] },
          },
          required: ["company", "roles", "tech_stack"],
        },
      },
    },
    temperature: 0,
    max_tokens: 800,
  });
  return JSON.parse(res.choices[0]?.message?.content || "");
}
