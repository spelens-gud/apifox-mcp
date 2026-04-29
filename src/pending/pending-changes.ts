import { randomUUID } from "node:crypto";
import type { OpenApiDocument } from "../openapi/types.js";

export interface PendingChangeInput {
  projectId: string;
  targetBranchId?: string;
  moduleId?: string;
  summary: string;
  diff: string;
  document: OpenApiDocument;
}

export interface PendingChange extends PendingChangeInput {
  changeId: string;
  createdAt: string;
}

export interface PendingChangeStore {
  create(input: PendingChangeInput): PendingChange;
  get(changeId: string): PendingChange | undefined;
  consume(changeId: string): PendingChange | undefined;
  discard(changeId: string): boolean;
}

export function createPendingChangeStore(
  idFactory: () => string = randomUUID,
): PendingChangeStore {
  const changes = new Map<string, PendingChange>();

  return {
    create(input) {
      const change: PendingChange = {
        ...input,
        document: structuredClone(input.document),
        changeId: idFactory(),
        createdAt: new Date().toISOString(),
      };

      changes.set(change.changeId, change);
      return clonePendingChange(change);
    },

    get(changeId) {
      const change = changes.get(changeId);
      return change === undefined ? undefined : clonePendingChange(change);
    },

    consume(changeId) {
      const change = changes.get(changeId);
      if (change === undefined) {
        return undefined;
      }

      changes.delete(changeId);
      return clonePendingChange(change);
    },

    discard(changeId) {
      return changes.delete(changeId);
    },
  };
}

function clonePendingChange(change: PendingChange): PendingChange {
  return {
    ...change,
    document: structuredClone(change.document),
  };
}

export const pendingChanges = createPendingChangeStore();
