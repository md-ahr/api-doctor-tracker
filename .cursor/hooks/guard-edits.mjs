#!/usr/bin/env node
import { readFileSync } from "node:fs";

function respond(body) {
  process.stdout.write(JSON.stringify(body));
}

let input = {};
try {
  input = JSON.parse(readFileSync(0, "utf8") || "{}");
} catch {
  respond({ permission: "allow" });
  process.exit(0);
}

const tool = String(input.tool_name ?? input.toolName ?? "");
if (tool && !/^(Write|StrReplace)$/i.test(tool)) {
  respond({ permission: "allow" });
  process.exit(0);
}

const raw = input.tool_input ?? input.arguments ?? input.input ?? {};
let data = raw;
if (typeof raw === "string") {
  try {
    data = JSON.parse(raw);
  } catch {
    data = {};
  }
}

const path = String(data.path ?? data.file_path ?? data.target_file ?? "");
const text = [data.contents, data.new_string, data.content]
  .filter((part) => typeof part === "string")
  .join("\n");

function deny(message) {
  respond({
    permission: "deny",
    user_message: message,
    agent_message: message,
  });
}

const ERROR_CODES = new Set([
  "VALIDATION_ERROR",
  "INVALID_CREDENTIALS",
  "UNAUTHENTICATED",
  "FORBIDDEN",
  "DOCTOR_NOT_FOUND",
  "PATIENT_NOT_FOUND",
  "EMAIL_IN_USE",
  "RATE_LIMITED",
  "INTERNAL",
]);

const HTTP_STATUS = new Set([200, 201, 400, 401, 403, 404, 409, 429, 500, 503]);

if (/\/(domain|application|infrastructure|interface)\//.test(path)) {
  deny("Do not add a domain, application, infrastructure, or interface tree.");
  process.exit(0);
}

const inSource = /(^|\/)(src|tests)\//.test(path) && path.endsWith(".ts");
if (!inSource) {
  respond({ permission: "allow" });
  process.exit(0);
}

const slop = slopViolation(text);
if (slop) {
  deny(slop);
  process.exit(0);
}

if (/\bexport\s+default\b/.test(text)) {
  deny("Use a named export. The API does not use default exports.");
  process.exit(0);
}

const badCode = [...text.matchAll(/new\s+DomainError\(\s*["']([A-Z0-9_]+)["']/g)]
  .map((match) => match[1])
  .find((code) => !ERROR_CODES.has(code));
if (badCode) {
  deny(`DomainError code ${badCode} is not in the LLD. Use one of: ${[...ERROR_CODES].join(", ")}.`);
  process.exit(0);
}

const badStatus = [...text.matchAll(/\b(?:status|sendData|sendFailure)\(\s*(?:res\s*,\s*)?(\d{3})\b/g)]
  .map((match) => Number(match[1]))
  .find((status) => !HTTP_STATUS.has(status));
if (badStatus) {
  deny(`HTTP ${badStatus} is not in the contract. Delete and logout return 200. Do not invent a status.`);
  process.exit(0);
}

const blocks = [
  {
    test: /from\s+["'](?:date-fns|luxon|dayjs|moment)["']|require\(\s*["'](?:date-fns|luxon|dayjs|moment)["']\s*\)/,
    message: "Calendar code uses lib/calendar.ts and Temporal. Do not add a date library.",
  },
  {
    test: /\bconsole\.(log|debug|info|warn|error|trace)\s*\(/,
    message: "console is a lint error. Log through lib/logger.ts (pino), and never log secrets.",
  },
  {
    test: /\bsyncIndexes\s*\(/,
    message: "Startup calls createIndexes(). syncIndexes() can drop an index that was created by hand.",
  },
  {
    test: /\bfetch\s*\(|from\s+["'](?:axios|got|node-fetch)["']|\bhttps?\.request\s*\(/,
    message: "Do not call a URL from the API. Outbound fetch of request data is SSRF.",
  },
  {
    test: /from\s+["'](?:node:)?child_process["']|\bexecSync\s*\(|\bexecFile(?:Sync)?\s*\(|\beval\s*\(|\bnew\s+Function\s*\(/,
    message: "Do not eval or shell out with request data.",
  },
  {
    test: /\$where\b/,
    message: "Do not use $where. Build an explicit filter from the Zod fields and escape search text.",
  },
  {
    test: /res\.redirect\(\s*req\./,
    message: "Do not redirect to a URL from the request.",
  },
];

const hit = blocks.find((block) => block.test.test(text));
if (hit) {
  deny(hit.message);
  process.exit(0);
}

respond({ permission: "allow" });

function slopViolation(source) {
  const rules = [
    {
      test: /@ts-(?:ignore|expect-error|nocheck)\b/,
      message: "Do not silence the type checker. Read the contract or Context7 and type the value.",
    },
    {
      test: /\beslint-disable\b/,
      message: "Do not disable a lint rule. Fix the code.",
    },
    {
      test: /\bas\s+any\b|[:<,(]\s*any\b|\bany\[\]/,
      message: "Do not use any. Name the type from the LLD or the schema.",
    },
    {
      test: /\bas\s+unknown\s+as\b/,
      message: "Do not cast through unknown. Use the type the contract defines.",
    },
    {
      test: /(?:^|\n)\s*(?:\/\/|\/\*+).*\b(?:TODO|FIXME|XXX|HACK)\b/i,
      message: "Do not leave TODO or FIXME. Implement the task or stop and name the missing contract.",
    },
    {
      test: /throw new Error\(\s*["'][^"']*(?:not implemented|todo)[^"']*["']/i,
      message: "Do not ship a not-implemented stub.",
    },
    {
      test: /\blorem ipsum\b|\bcoming soon\b/i,
      message: "Do not use placeholder copy. Use the message from the LLD.",
    },
    {
      test: /catch\s*(?:\(\s*[^)]*\s*\))?\s*\{\s*\}/,
      message: "Do not swallow errors with an empty catch. Let DomainError reach the error handler.",
    },
  ];
  return rules.find((rule) => rule.test.test(source))?.message;
}
