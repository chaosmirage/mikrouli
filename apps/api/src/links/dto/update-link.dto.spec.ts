import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { UpdateLinkDto } from './update-link.dto';

async function errors(url: string): Promise<string[]> {
  const dto = plainToInstance(UpdateLinkDto, { url });
  const violations = await validate(dto);
  return violations.flatMap((v) => Object.values(v.constraints ?? {}));
}

// UpdateLinkDto must reject exactly the URLs CreateLinkDto rejects: it shares
// the same validation decorators via PickType rather than a re-derived set of
// rules that could silently drift from the create path.
describe('UpdateLinkDto URL validation', () => {
  it('accepts a normal public HTTPS URL', async () => {
    const result = await errors('https://example.com/new-destination');
    expect(result).toHaveLength(0);
  });

  it('rejects a URL with no protocol', async () => {
    const result = await errors('example.com');
    expect(result.length).toBeGreaterThan(0);
  });

  it('rejects a loopback IPv4 address 127.0.0.1', async () => {
    const result = await errors('http://127.0.0.1/');
    expect(result.length).toBeGreaterThan(0);
  });

  it('rejects the cloud metadata endpoint 169.254.169.254', async () => {
    const result = await errors('http://169.254.169.254/latest/meta-data/');
    expect(result.length).toBeGreaterThan(0);
  });

  it('rejects a private 10.x.x.x address', async () => {
    const result = await errors('http://10.0.0.1/internal');
    expect(result.length).toBeGreaterThan(0);
  });

  it('rejects a javascript: scheme URL', async () => {
    const result = await errors('javascript:alert(1)');
    expect(result.length).toBeGreaterThan(0);
  });
});
