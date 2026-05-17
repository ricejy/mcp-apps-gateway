import {
  registerAppResource,
  registerAppTool,
  RESOURCE_MIME_TYPE,
} from "@modelcontextprotocol/ext-apps/server";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult, ReadResourceResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import fs from "node:fs/promises";
import path from "node:path";

const API_BASE = "https://api.politiloggen.politiet.no";

const DIST_DIR = import.meta.filename.endsWith(".ts")
  ? path.join(import.meta.dirname, "dist")
  : import.meta.dirname;

interface MessageDto {
  id: string | null;
  threadId: string | null;
  category: string | null;
  district: string | null;
  municipality: string | null;
  area: string | null;
  isActive: boolean;
  text: string | null;
  createdOn: string;
  updatedOn: string;
  imageUrl: string | null;
  isEdited: boolean;
}

interface MessageFilterResponse {
  messages: MessageDto[] | null;
  totalCount: number;
}

async function fetchMessages(params: {
  districts?: string[];
  categories?: string[];
  take?: number;
  skip?: number;
}): Promise<MessageFilterResponse> {
  const url = new URL(`${API_BASE}/messages`);
  if (params.districts) {
    for (const d of params.districts) url.searchParams.append("Districts", d);
  }
  if (params.categories) {
    for (const c of params.categories) url.searchParams.append("Categories", c);
  }
  url.searchParams.set("Take", String(params.take ?? 50));
  url.searchParams.set("Skip", String(params.skip ?? 0));
  url.searchParams.set("SortBy", "Date");
  url.searchParams.set("SortOrder", "Descending");

  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`);
  return res.json() as Promise<MessageFilterResponse>;
}

interface NamedItem {
  id: string | number;
  name: string;
}

async function fetchCategories(): Promise<NamedItem[]> {
  const res = await fetch(`${API_BASE}/categories?language=nb`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json() as Promise<NamedItem[]>;
}

async function fetchDistricts(): Promise<NamedItem[]> {
  const res = await fetch(`${API_BASE}/districts`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json() as Promise<NamedItem[]>;
}

export function createServer(): McpServer {
  const server = new McpServer({
    name: "Politiloggen Dashboard",
    version: "1.0.0",
  });

  const resourceUri = "ui://politiloggen/dashboard.html";

  registerAppTool(
    server,
    "get-police-incidents",
    {
      title: "Police Incidents",
      description:
        "Fetches recent police incidents from Norway's Politiloggen. Returns incidents with category, district, municipality, area, status, and description.",
      inputSchema: {
        districts: z
          .array(z.string())
          .optional()
          .describe("Filter by police districts"),
        categories: z
          .array(z.string())
          .optional()
          .describe("Filter by incident categories"),
        take: z
          .number()
          .min(1)
          .max(50)
          .optional()
          .describe("Number of results (max 50)"),
      },
      _meta: { ui: { resourceUri } },
    },
    async ({ districts, categories, take }): Promise<CallToolResult> => {
      const data = await fetchMessages({ districts, categories, take: take ?? 50 });
      const summary = `${data.totalCount} total incidents. Showing ${data.messages?.length ?? 0} most recent.`;
      return {
        content: [{ type: "text", text: summary }],
        structuredContent: data as unknown as Record<string, unknown>,
      };
    },
  );

  // App-only tool for refreshing data from the UI
  registerAppTool(
    server,
    "refresh-incidents",
    {
      title: "Refresh Incidents",
      description: "Fetches latest incidents for the dashboard UI.",
      inputSchema: {
        districts: z.array(z.string()).optional(),
        categories: z.array(z.string()).optional(),
        take: z.number().min(1).max(50).optional(),
        skip: z.number().min(0).optional(),
      },
      _meta: { ui: { resourceUri, visibility: ["app"] } },
    },
    async ({ districts, categories, take, skip }): Promise<CallToolResult> => {
      const data = await fetchMessages({
        districts,
        categories,
        take: take ?? 50,
        skip: skip ?? 0,
      });
      return {
        content: [{ type: "text", text: `${data.messages?.length ?? 0} incidents` }],
        structuredContent: data as unknown as Record<string, unknown>,
      };
    },
  );

  // App-only tool for fetching filter options
  registerAppTool(
    server,
    "get-filter-options",
    {
      title: "Get Filter Options",
      description: "Fetches available categories and districts.",
      inputSchema: {},
      _meta: { ui: { resourceUri, visibility: ["app"] } },
    },
    async (): Promise<CallToolResult> => {
      const [categories, districts] = await Promise.all([
        fetchCategories(),
        fetchDistricts(),
      ]);
      return {
        content: [{ type: "text", text: "Filter options loaded" }],
        structuredContent: { categories, districts } as unknown as Record<string, unknown>,
      };
    },
  );

  registerAppResource(
    server,
    resourceUri,
    resourceUri,
    { mimeType: RESOURCE_MIME_TYPE },
    async (): Promise<ReadResourceResult> => {
      const html = await fs.readFile(
        path.join(DIST_DIR, "mcp-app.html"),
        "utf-8",
      );
      return {
        contents: [
          {
            uri: resourceUri,
            mimeType: RESOURCE_MIME_TYPE,
            text: html,
          },
        ],
      };
    },
  );

  return server;
}
