import { submitRouter } from '../../../../src/core/api/submit/route';

interface RouteLayer {
  route?: { path: string; methods: Record<string, boolean>; stack: { handle: { name: string } }[] };
}

const GUARDS = [
  'requireSubmissionOpen',
  'requireSubmissionRead',
  'requireSubmissionWrite',
  'requireSubmissionDelete',
  'requireSignedInSubmitter',
];

const routes = (submitRouter as unknown as { stack: RouteLayer[] }).stack.flatMap((l) =>
  l.route
    ? Object.keys(l.route.methods).map((method) => ({
        method,
        path: l.route!.path,
        handlers: l.route!.stack.map((s) => s.handle.name),
      }))
    : [],
);

/** Names of the handlers mounted on one route, in order. */
const handlersFor = (method: string, path: string): string[] => {
  const route = routes.find((r) => r.method === method && r.path === path);
  if (!route) throw new Error(`No ${method.toUpperCase()} ${path} on the submit router`);
  return route.handlers;
};

it.each([
  ['get', '/submissions/:id', 'requireSubmissionRead'],
  ['get', '/submissions/:id/data', 'requireSubmissionRead'],
  ['get', '/submissions/:id/schema', 'requireSubmissionRead'],
  ['get', '/submissions/:id/fill', 'requireSubmissionRead'],
  ['post', '/submissions/:id/save', 'requireSubmissionWrite'],
  ['post', '/submissions/:id/submit', 'requireSubmissionWrite'],
  ['delete', '/submissions/:id', 'requireSubmissionDelete'],
])('%s %s loads the submission once, then decides with %s', (method, path, guard) => {
  const handlers = handlersFor(method, path);
  expect(handlers.filter((name) => name === 'loadSubmitterSubmission')).toHaveLength(1);
  expect(handlers.indexOf('loadSubmitterSubmission')).toBeLessThan(handlers.indexOf(guard));
});

it('POST /submissions decides with requireSubmissionOpen, with no submission to load', () => {
  const handlers = handlersFor('post', '/submissions');
  expect(handlers).toContain('requireSubmissionOpen');
  expect(handlers).not.toContain('loadSubmitterSubmission');
});

it.each(['/submissions/mine', '/forms/mine', '/workspaces/mine'])(
  'GET %s goes through requireSignedInSubmitter',
  (path) => {
    expect(handlersFor('get', path)).toContain('requireSignedInSubmitter');
  },
);

it('registers GET /submissions/mine before GET /submissions/:id, which would take it as an id', () => {
  const order = routes.filter((r) => r.method === 'get').map((r) => r.path);
  expect(order.indexOf('/submissions/mine')).toBeLessThan(order.indexOf('/submissions/:id'));
});

it.each(routes.map((r) => [`${r.method.toUpperCase()} ${r.path}`, r.handlers] as const))(
  '%s runs exactly one submit-mode guard, before its handler',
  (_route, handlers) => {
    const guards = handlers.filter((name) => GUARDS.includes(name));
    expect(guards).toHaveLength(1);
    expect(handlers.indexOf(guards[0])).toBeLessThan(handlers.length - 1);
  },
);

it.each([
  ['/submissions/:id/save', 'replayRecordedSave'],
  ['/submissions/:id/submit', 'replayRecordedSubmit'],
])('POST %s answers a recorded write after the load, before any guard', (path, replay) => {
  const handlers = handlersFor('post', path);
  const at = handlers.indexOf(replay);
  expect(at).toBeGreaterThan(handlers.indexOf('loadSubmitterSubmission'));
  expect(at).toBeLessThan(handlers.indexOf('requireSubmissionWrite'));
});

it('POST /submissions answers a recorded open before requireSubmissionOpen', () => {
  const handlers = handlersFor('post', '/submissions');
  expect(handlers.indexOf('replayRecordedOpen')).toBeGreaterThanOrEqual(0);
  expect(handlers.indexOf('replayRecordedOpen')).toBeLessThan(
    handlers.indexOf('requireSubmissionOpen'),
  );
});

it('POST /submissions/:id/save checks drafts after write access, before its handler', () => {
  const handlers = handlersFor('post', '/submissions/:id/save');
  const draftGuard = handlers.indexOf('requireDraftSave');
  expect(draftGuard).toBeGreaterThan(handlers.indexOf('requireSubmissionWrite'));
  expect(draftGuard).toBeLessThan(handlers.length - 1);
});

it.each(['/submissions', '/submissions/:id/submit'])('POST %s does not check drafts', (path) => {
  expect(handlersFor('post', path)).not.toContain('requireDraftSave');
});
