import { Response } from 'express';

const connections = new Map<string, Response[]>();

export const addStreamConnection = (userId: string, res: Response) => {
  if (!connections.has(userId)) {
    connections.set(userId, []);
  }
  connections.get(userId)!.push(res);

  res.on('close', () => {
    const userConns = connections.get(userId);
    if (userConns) {
      const idx = userConns.indexOf(res);
      if (idx !== -1) {
        userConns.splice(idx, 1);
      }
      if (userConns.length === 0) {
        connections.delete(userId);
      }
    }
  });
};

export const emitWorkspaceUpdate = (workspace: Record<string, unknown>, userIds: string[]) => {
  const payload = `data: ${JSON.stringify(workspace)}\n\n`;
  for (const userId of userIds) {
    const userConns = connections.get(userId);
    if (userConns) {
      for (const res of userConns) {
        res.write(payload);
      }
    }
  }
};
