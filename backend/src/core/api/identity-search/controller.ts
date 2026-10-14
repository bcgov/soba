import { asyncHandler } from '../shared/asyncHandler';
import { IdirUserSearchQuerySchema } from './schema';
import { searchIdirUsers } from './service';
export const queryIdirUsers = asyncHandler(async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const { email, firstName, lastName, guid } = IdirUserSearchQuerySchema.parse(req.query);
  res.json(await searchIdirUsers({ email, firstName, lastName, guid }));
});
