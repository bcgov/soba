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

const dataConnections = new Map<string, Response[]>();

export const addDataStreamConnection = (userId: string, res: Response) => {
  if (!dataConnections.has(userId)) {
    dataConnections.set(userId, []);
  }
  dataConnections.get(userId)!.push(res);

  res.on('close', () => {
    const userConns = dataConnections.get(userId);
    if (userConns) {
      const idx = userConns.indexOf(res);
      if (idx !== -1) {
        userConns.splice(idx, 1);
      }
      if (userConns.length === 0) {
        dataConnections.delete(userId);
      }
    }
  });
};

export const emitSubmissionsUpdate = (submission: Record<string, unknown>, userIds: string[]) => {
  const payload = `data: ${JSON.stringify(submission)}\n\n`;
  for (const userId of userIds) {
    const userConns = connections.get(userId);
    if (userConns) {
      for (const res of userConns) {
        res.write(payload);
      }
    }
  }
};

export const emitSubmissionDataUpdate = (
  submissionData: Record<string, unknown>,
  userIds: string[],
) => {
  const payload = `data: ${JSON.stringify(submissionData)}\n\n`;
  for (const userId of userIds) {
    const userConns = dataConnections.get(userId);
    if (userConns) {
      for (const res of userConns) {
        res.write(payload);
      }
    }
  }
};
