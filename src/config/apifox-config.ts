export interface ApifoxConfig {
  apiBaseUrl: string;
  accessToken?: string;
  projectId?: string;
  branchId?: number;
  moduleId?: number;
  timeoutMs: number;
  missingForRequest(input?: { projectId?: string; requireProjectId?: boolean }): string[];
}

function optionalNumber(value: string | undefined): number | undefined {
  if (value === undefined || value.trim() === "") {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function readApifoxConfig(env: NodeJS.ProcessEnv = process.env): ApifoxConfig {
  const config = {
    apiBaseUrl: env.APIFOX_API_BASE_URL ?? "https://api.apifox.com",
    accessToken: env.APIFOX_ACCESS_TOKEN,
    projectId: env.APIFOX_PROJECT_ID,
    branchId: optionalNumber(env.APIFOX_BRANCH_ID),
    moduleId: optionalNumber(env.APIFOX_MODULE_ID),
    timeoutMs: optionalNumber(env.APIFOX_TIMEOUT_MS) ?? 15000,
  };

  return {
    ...config,
    missingForRequest(input = {}) {
      const missing: string[] = [];
      if (!config.accessToken) {
        missing.push("APIFOX_ACCESS_TOKEN");
      }
      if (input.requireProjectId && !input.projectId && !config.projectId) {
        missing.push("APIFOX_PROJECT_ID");
      }
      return missing;
    },
  };
}
