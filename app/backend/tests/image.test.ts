// node --test tests/image.test.ts
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { sniffImage } from '../src/utils/image.ts';

describe('sniffImage', () => {
  it('reconhece JPEG, PNG e WebP pela assinatura', () => {
    assert.equal(sniffImage(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0])), 'image/jpeg');
    assert.equal(sniffImage(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0])), 'image/png');
    assert.equal(sniffImage(Buffer.concat([Buffer.from('RIFF'), Buffer.from([0, 0, 0, 0]), Buffer.from('WEBP')])), 'image/webp');
  });
  it('rejeita SVG, HTML e lixo mesmo com Content-Type de imagem', () => {
    assert.equal(sniffImage(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>')), null);
    assert.equal(sniffImage(Buffer.from('<html></html>')), null);
    assert.equal(sniffImage(Buffer.alloc(0)), null);
  });
});
