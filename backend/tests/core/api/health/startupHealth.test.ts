import { logTenantServiceReadiness } from '../../../../src/core/api/health/startupHealth';
import { checkTenantEngineReadiness } from '../../../../src/core/integrations/tenant/TenantEngineRegistry';
import { log } from '../../../../src/core/logging';

jest.mock('../../../../src/core/integrations/tenant/TenantEngineRegistry');
jest.mock('../../../../src/core/logging', () => ({
  log: {
    info: jest.fn(),
    warn: jest.fn(),
  },
}));

describe('startupHealth logTenantServiceReadiness', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  it('logs info when all backends ready', async () => {
    jest.mocked(checkTenantEngineReadiness).mockResolvedValue({
      engine1: { ok: true },
      engine2: { ok: true },
    });

    await logTenantServiceReadiness();

    expect(log.info).toHaveBeenCalledWith(
      { tenant: { engine1: { ok: true }, engine2: { ok: true } } },
      'Tenant readiness: all backends ready',
    );
    expect(log.warn).not.toHaveBeenCalled();
  });

  it('logs warn when some backends are not ready', async () => {
    jest.mocked(checkTenantEngineReadiness).mockResolvedValue({
      engine1: { ok: true },
      engine2: { ok: false, message: 'timeout' },
    });

    await logTenantServiceReadiness();

    expect(log.warn).toHaveBeenCalledWith(
      { tenant: { engine1: { ok: true }, engine2: { ok: false, message: 'timeout' } } },
      'Tenant readiness: not ready: engine2',
    );
    expect(log.info).not.toHaveBeenCalled();
  });

  it('logs warn when check throws', async () => {
    const error = new Error('fail');
    jest.mocked(checkTenantEngineReadiness).mockRejectedValue(error);

    await logTenantServiceReadiness();

    expect(log.warn).toHaveBeenCalledWith({ err: error }, 'Tenant readiness could not run');
    expect(log.info).not.toHaveBeenCalled();
  });
});
