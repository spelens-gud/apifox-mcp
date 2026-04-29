import { createApifoxClient, type ApifoxClient } from "../apifox/apifox-client.js";
import { readApifoxConfig, type ApifoxConfig } from "../config/apifox-config.js";

export interface ApifoxReady {
  config: ApifoxConfig;
  projectId: string;
  client: ApifoxClient;
}

export function textResponse(text: string) {
  return { content: [{ type: "text" as const, text }] };
}

export function jsonResponse(value: unknown) {
  return textResponse(JSON.stringify(value, null, 2));
}

export function requireApifox(projectId?: string): ApifoxReady | { error: string } {
  const config = readApifoxConfig();
  const missing = config.missingForRequest({ projectId, requireProjectId: true });

  if (missing.length > 0) {
    return { error: `Missing required Apifox configuration: ${missing.join(", ")}` };
  }

  return {
    config,
    projectId: projectId ?? config.projectId!,
    client: createApifoxClient({
      apiBaseUrl: config.apiBaseUrl,
      accessToken: config.accessToken!,
      timeoutMs: config.timeoutMs,
    }),
  };
}

export function numberToPendingValue(value: number | undefined): string | undefined {
  return value === undefined ? undefined : String(value);
}

export function pendingValueToNumber(value: string | undefined): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}
