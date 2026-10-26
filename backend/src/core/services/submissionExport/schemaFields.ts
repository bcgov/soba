/** Column names from a Form.io schema, ported from CHEFS 1. */

/** The Form.io component fields the export reads. */
export interface FormComponent {
  key?: string;
  type?: string;
  input?: boolean;
  tree?: boolean;
  columns?: Array<{ components?: FormComponent[] }>;
  rows?: unknown[];
  components?: FormComponent[];
  values?: Array<{ value: string }>;
  questions?: Array<{ value: string }>;
}

// Layout components with no children.
const LAYOUT_TYPES = new Set(['htmlelement', 'content', 'simplecontent', 'button']);
// Answers keyed by option.
const SUB_VALUE_TYPES = new Set(['simplecheckboxes', 'selectboxes', 'survey', 'tree']);
// Containers whose key prefixes their children.
const PREFIX_TYPES = new Set([
  'datagrid',
  'container',
  'editgrid',
  'address',
  'dynamicWizard',
  'datatable',
  'tagpad',
]);
const NON_PREFIX_TYPES = new Set(['panel', 'table', 'well', 'columns', 'fieldset', 'tabs', 'form']);

const join = (path: string, key: string) => (path ? `${path}.${key}` : key);

/** The component's own columns. */
const ownPaths = (component: FormComponent, path: string): string[] => {
  const { key } = component;
  if (!key) return [];
  const options = component.type === 'survey' ? component.questions : component.values;
  if (SUB_VALUE_TYPES.has(component.type ?? '') && options) {
    return options.map((option) => join(path, `${key}.${option.value}`));
  }
  return [join(path, key)];
};

/** Path for the component's children. */
const childPath = (component: FormComponent, path: string): string => {
  if (!component.key) return path;
  if (component.type === 'form') return `${join(path, component.key)}.data`;
  const type = component.type ?? '';
  if (!NON_PREFIX_TYPES.has(type) && (PREFIX_TYPES.has(type) || component.tree)) {
    return join(path, component.key);
  }
  return path;
};

const childComponents = (component: FormComponent): FormComponent[][] => {
  if (Array.isArray(component.columns)) return component.columns.map((c) => c.components ?? []);
  if (Array.isArray(component.rows)) {
    return component.rows.flatMap((row) =>
      Array.isArray(row)
        ? row.map((cell: { components?: FormComponent[] }) => cell?.components ?? [])
        : [],
    );
  }
  return component.components ? [component.components] : [];
};

/** Answer columns in form order. */
export const flattenComponents = (components: FormComponent[] | undefined, path = ''): string[] =>
  (components ?? []).flatMap((component) => {
    if (!component) return [];
    const isLayout =
      Array.isArray(component.columns) ||
      Array.isArray(component.rows) ||
      (Array.isArray(component.components) && !component.input) ||
      LAYOUT_TYPES.has(component.type ?? '');
    const own = component.tree || !isLayout ? ownPaths(component, path) : [];
    const sub = childPath(component, path);
    const children = childComponents(component).flatMap((list) => flattenComponents(list, sub));
    return [...own, ...children];
  });

const INNER_INDEX = /\.\d*\./;
const END_INDEX = /\.\d*$/;

/** Data headers in schema order, `form.*` first; unmatched ones dropped, as in CHEFS 1. */
export const mapOrder = (headers: string[], order: string[]): string[] => {
  const indexed = new Map<string, string[]>();
  for (const header of headers) {
    const hasInner = INNER_INDEX.test(header);
    if (!hasInner && !END_INDEX.test(header)) continue;
    const inner = header.replaceAll(/\.\d*\./g, '.');
    const end = header.replace(END_INDEX, '');
    const group = indexed.get(inner) ?? indexed.get(end);
    if (group) {
      group.push(header);
      continue;
    }
    indexed.set(hasInner ? inner : end, [header]);
  }
  const result = headers.filter((header) => header.startsWith('form.'));
  for (const field of order) {
    const group = indexed.get(field);
    if (group) {
      result.push(...group);
      continue;
    }
    if (headers.includes(field)) {
      result.push(field);
      continue;
    }
    result.push(...headers.filter((header) => header.includes(field)));
  }
  return [...new Set(result)];
};
