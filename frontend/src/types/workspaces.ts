export type WorkspaceItem = {
  id: string;
  name: string;
  slug: string | null;
  kind: string;
  role: string;
  status: string;
};

export type WorkspacesResponse = {
  items: WorkspaceItem[];
  page: {
    limit: number;
    hasMore: boolean;
    nextCursor: string | null;
    cursorMode: 'id' | 'ts_id';
  };
  filters: {
    kind?: string;
    status?: string;
  };
  sort: string;
};

export type CreateWorkspaceBody = {
  name: string;
};

export type UpdateWorkspaceBody = {
  name: string;
};
