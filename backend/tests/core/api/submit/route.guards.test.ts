import { submitRouter } from '../../../../src/core/api/submit/route';

interface RouteLayer {
  route?: { path: string; methods: Record<string, boolean>; stack: { handle: { name: string } }[] };
}

const GUARDS = ['requireSubmissionRead', 'requireFormSubmitAccess'];

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
  '/submissions/:id',
  '/submissions/:id/data',
  '/submissions/:id/schema',
  '/submissions/:id/fill',
])('GET %s reads through requireSubmissionRead', (path) => {
  expect(handlersFor('get', path)).toContain('requireSubmissionRead');
});

it.each(['/submissions', '/submissions/:id/save', '/submissions/:id/submit'])(
  'POST %s goes through requireFormSubmitAccess',
  (path) => {
    expect(handlersFor('post', path)).toContain('requireFormSubmitAccess');
  },
);

it.each(routes.map((r) => [`${r.method.toUpperCase()} ${r.path}`, r.handlers] as const))(
  '%s runs exactly one submit-mode guard, before its handler',
  (_route, handlers) => {
    const guards = handlers.filter((name) => GUARDS.includes(name));
    expect(guards).toHaveLength(1);
    expect(handlers.indexOf(guards[0])).toBeLessThan(handlers.length - 1);
  },
);
