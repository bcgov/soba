import {
  flattenComponents,
  mapOrder,
  type FormComponent,
} from '../../../../src/core/services/submissionExport/schemaFields';

const components: FormComponent[] = [
  { type: 'content', key: 'intro' },
  {
    type: 'panel',
    key: 'page1',
    components: [{ type: 'textfield', key: 'name', input: true }],
  },
  {
    type: 'columns',
    key: 'cols',
    columns: [
      { components: [{ type: 'number', key: 'age', input: true }] },
      { components: [{ type: 'email', key: 'email', input: true }] },
    ],
  },
  {
    type: 'table',
    key: 'tbl',
    rows: [[{ components: [{ type: 'textfield', key: 'cell', input: true }] }]],
  },
  {
    type: 'datagrid',
    key: 'people',
    input: true,
    components: [
      { type: 'textfield', key: 'first', input: true },
      { type: 'textfield', key: 'last', input: true },
    ],
  },
  {
    type: 'selectboxes',
    key: 'colours',
    input: true,
    values: [{ value: 'red' }, { value: 'blue' }],
  },
  {
    type: 'survey',
    key: 'rating',
    input: true,
    questions: [{ value: 'speed' }, { value: 'price' }],
  },
  {
    type: 'form',
    key: 'nested',
    input: true,
    components: [{ type: 'textfield', key: 'inner', input: true }],
  },
  { type: 'simplefile', key: 'upload', input: true },
  { type: 'button', key: 'submit', input: true },
];

describe('flattenComponents (CHEFS 1 port)', () => {
  it('lists answer columns in form order, skipping layout and buttons', () => {
    expect(flattenComponents(components)).toEqual([
      'name',
      'age',
      'email',
      'cell',
      'people',
      'people.first',
      'people.last',
      'colours.red',
      'colours.blue',
      'rating.speed',
      'rating.price',
      'nested',
      'nested.data.inner',
      'upload',
    ]);
  });

  it('prefixes a sub-value component inside a grid with the grid key', () => {
    expect(
      flattenComponents([
        {
          type: 'datagrid',
          key: 'grid',
          input: true,
          components: [{ type: 'selectboxes', key: 'pick', input: true, values: [{ value: 'a' }] }],
        },
      ]),
    ).toEqual(['grid', 'grid.pick.a']);
  });

  it('answers nothing for a missing schema', () => {
    expect(flattenComponents(undefined)).toEqual([]);
  });
});

describe('mapOrder (CHEFS 1 port)', () => {
  it('puts form.* first, then data headers in schema order, grouping indexed and nested ones', () => {
    const headers = [
      'upload.name',
      'people.1.first',
      'form.submissionId',
      'name',
      'people.0.first',
      'stray',
    ];
    expect(mapOrder(headers, ['name', 'people.first', 'upload'])).toEqual([
      'form.submissionId',
      'name',
      'people.1.first',
      'people.0.first',
      'upload.name',
    ]);
  });
});
