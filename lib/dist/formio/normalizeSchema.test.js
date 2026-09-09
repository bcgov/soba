"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const normalizeSchema_1 = require("./normalizeSchema");
describe('normalizeSchema', () => {
    it('applies the legacy CHEFS-1 type fix (simple…/…advanced)', () => {
        const out = (0, normalizeSchema_1.normalizeSchema)({ components: [{ type: 'simplenumberadvanced', key: 'a' }] });
        expect(out.components[0].type).toBe('number');
    });
    it('strips the simple… prefix with no advanced suffix', () => {
        const out = (0, normalizeSchema_1.normalizeSchema)({ components: [{ type: 'simpleemail', key: 'b' }] });
        expect(out.components[0].type).toBe('email');
    });
    it('leaves a standard Form.io v5 type unchanged', () => {
        const out = (0, normalizeSchema_1.normalizeSchema)({ components: [{ type: 'textfield', key: 'c' }] });
        expect(out.components[0].type).toBe('textfield');
    });
    it('keeps only form-definition fields and drops engine/document metadata', () => {
        const out = (0, normalizeSchema_1.normalizeSchema)({
            title: 'My Form',
            name: 'soba-abc',
            path: 'soba-abc',
            tags: ['soba', 'ws'],
            access: [{ type: 'read_all', roles: ['x'] }],
            submissionAccess: [],
            properties: { soba_workspace_id: 'ws' },
            pdfComponents: [],
            _id: 'mongoid',
            machineName: 'm',
            components: [{ type: 'textfield', key: 'a' }],
        });
        expect(Object.keys(out).sort()).toEqual(['components', 'display', 'title', 'type']);
        expect(out.title).toBe('My Form');
        expect(out.type).toBe('form');
        expect(out.display).toBe('form');
    });
    it('drops a non-object widget and flattened widget.* keys, recursing into nested components', () => {
        const out = (0, normalizeSchema_1.normalizeSchema)({
            components: [
                { type: 'textfield', key: 'a', widget: '', 'widget.type': 'input' },
                { type: 'day', key: 'b', widget: null },
                {
                    type: 'container',
                    key: 'p',
                    components: [{ type: 'textfield', key: 'n', widget: '' }],
                },
            ],
        });
        const comps = out.components;
        expect('widget' in comps[0]).toBe(false);
        expect('widget.type' in comps[0]).toBe(false);
        expect('widget' in comps[1]).toBe(false);
        const nested = comps[2].components[0];
        expect('widget' in nested).toBe(false);
    });
    it('keeps a valid object widget', () => {
        const out = (0, normalizeSchema_1.normalizeSchema)({
            components: [{ type: 'datetime', key: 'd', widget: { type: 'calendar' } }],
        });
        expect(out.components[0].widget).toEqual({ type: 'calendar' });
    });
});
