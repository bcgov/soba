"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.makeSortEnum = exports.sortTokensFor = exports.OffsetPageSchema = void 0;
const zod_1 = require("zod");
exports.OffsetPageSchema = zod_1.z.object({
    offset: zod_1.z.number().int().min(0),
    limit: zod_1.z.number().int().min(1),
    total: zod_1.z.number().int().min(0),
});
const sortTokensFor = (fields) => fields.flatMap((field) => [`${field}:asc`, `${field}:desc`]);
exports.sortTokensFor = sortTokensFor;
const makeSortEnum = (fields) => zod_1.z.enum((0, exports.sortTokensFor)(fields));
exports.makeSortEnum = makeSortEnum;
