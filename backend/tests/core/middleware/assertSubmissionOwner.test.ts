import type { Request } from 'express';
import { assertSubmissionOwner } from '../../../src/core/middleware/formSubmitAccess';
import { ForbiddenError, UnauthorizedError } from '../../../src/core/errors';

function makeReq(opts: { actorId?: string; authed?: boolean }): Request {
  return {
    actorId: opts.actorId,
    user: opts.authed ? ({ providerCode: 'azureidir' } as Express.User) : undefined,
  } as unknown as Request;
}

const submission = (submittedBy: string | null) => ({ id: 's1', formId: 'f1', submittedBy });

describe('assertSubmissionOwner', () => {
  it('passes the owner', () => {
    expect(() =>
      assertSubmissionOwner(makeReq({ actorId: 'u1', authed: true }), submission('u1')),
    ).not.toThrow();
  });

  it('denies an authenticated non-owner with 403', () => {
    expect(() =>
      assertSubmissionOwner(makeReq({ actorId: 'u2', authed: true }), submission('u1')),
    ).toThrow(ForbiddenError);
  });

  it('denies an anonymous non-owner with 401', () => {
    expect(() => assertSubmissionOwner(makeReq({ actorId: 'public' }), submission('u1'))).toThrow(
      UnauthorizedError,
    );
  });

  it('denies a submission with no owner', () => {
    expect(() =>
      assertSubmissionOwner(makeReq({ actorId: 'u1', authed: true }), submission(null)),
    ).toThrow(ForbiddenError);
  });

  it('denies a caller with no actor even when the owner is also missing', () => {
    expect(() => assertSubmissionOwner(makeReq({}), submission(null))).toThrow(UnauthorizedError);
  });
});
