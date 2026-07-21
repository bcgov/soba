import { toCdogsRenderBody } from '../../../../src/plugins/shared/cdogs/renderBody';

describe('toCdogsRenderBody', () => {
  it('forces overwrite:true while preserving other options', () => {
    const body = toCdogsRenderBody({ template: { content: 'x' }, options: { reportName: 'r' } });
    expect(body.options).toEqual({ reportName: 'r', overwrite: true });
    expect(body.template).toEqual({ content: 'x' });
  });

  it('adds an options object when the payload has none', () => {
    const body = toCdogsRenderBody({ template: {} });
    expect(body.options).toEqual({ overwrite: true });
  });

  it('flattens the form-engine .data wrapper so templates use {d.field}', () => {
    const body = toCdogsRenderBody({ data: { data: { textField: 'saved' }, form: 'f' } });
    expect(body.data).toEqual({ textField: 'saved' });
  });

  it('passes already-flat data through unchanged', () => {
    const body = toCdogsRenderBody({ data: { textField: 'live' } });
    expect(body.data).toEqual({ textField: 'live' });
  });

  it('defaults missing data to an empty object', () => {
    const body = toCdogsRenderBody({ template: {} });
    expect(body.data).toEqual({});
  });
});
