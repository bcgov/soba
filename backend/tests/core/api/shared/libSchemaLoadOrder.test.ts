// @soba/lib builds its schemas the first time it is required, and zod v4 only gives `.openapi()` to
// schemas built after extendZodWithOpenApi. Each module has to load as the first to require the lib.
describe.each(['forms', 'submissions', 'workspaces'])('%s schema module', (name) => {
  it('loads when it is the first module to require @soba/lib', async () => {
    await jest.isolateModulesAsync(async () => {
      await expect(import(`../../../../src/core/api/${name}/schema`)).resolves.toBeDefined();
    });
  });
});
