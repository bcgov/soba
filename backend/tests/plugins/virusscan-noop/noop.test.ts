import { Readable } from 'stream';
import { createPluginConfigReader } from '../../../src/core/config/pluginConfig';
import { virusScanPluginDefinition } from '../../../src/plugins/virusscan-noop';

describe('virusscan-noop', () => {
  const adapter = virusScanPluginDefinition.createAdapter(
    createPluginConfigReader(virusScanPluginDefinition.code),
  );

  it('has the expected code', () => {
    expect(virusScanPluginDefinition.code).toBe('virusscan-noop');
  });

  it('reports buffers clean', async () => {
    const res = await adapter.scanBuffer(Buffer.from('anything'));
    expect(res).toEqual({ verdict: 'clean', viruses: [], scannerCode: 'virusscan-noop' });
  });

  it('reports streams clean', async () => {
    const res = await adapter.scanStream(Readable.from(Buffer.from('anything')));
    expect(res.verdict).toBe('clean');
  });

  it('reports files clean', async () => {
    const res = await adapter.scanFile('/does/not/matter');
    expect(res.verdict).toBe('clean');
  });

  it('ping resolves true', async () => {
    await expect(adapter.ping()).resolves.toBe(true);
  });
});
