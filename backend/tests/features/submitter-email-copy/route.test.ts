import { submitterEmailCopyRouter } from '../../../src/features/submitter-email-copy/route';

interface RouteLayer {
  route?: { path: string; methods: Record<string, boolean>; stack: { handle: { name: string } }[] };
}

const handlers = (submitterEmailCopyRouter as unknown as { stack: RouteLayer[] }).stack
  .filter((l) => l.route?.path === '/:id/email-copy' && l.route.methods.post)
  .flatMap((l) => l.route!.stack.map((s) => s.handle.name));

// The same order as the core submit routes: read once, gate, one guard, then the handler.
it('POST /:id/email-copy loads the submission once, then gates and guards it before the handler', () => {
  expect(handlers.filter((name) => name === 'loadSubmitterSubmission')).toHaveLength(1);
  const load = handlers.indexOf('loadSubmitterSubmission');
  const guard = handlers.indexOf('requireSubmissionEmailCopy');
  expect(load).toBeGreaterThan(0);
  expect(guard).toBeGreaterThan(load + 1);
  expect(handlers[handlers.length - 1]).not.toBe('requireSubmissionEmailCopy');
  expect(handlers).toHaveLength(guard + 2);
});
