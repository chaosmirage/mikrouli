import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateLinkDto } from './create-link.dto';

async function errors(url: string): Promise<string[]> {
  const dto = plainToInstance(CreateLinkDto, { url });
  const violations = await validate(dto);
  return violations.flatMap((v) => Object.values(v.constraints ?? {}));
}

describe('CreateLinkDto URL validation', () => {
  it('accepts a normal public HTTPS URL', async () => {
    const result = await errors('https://example.com/path?q=1');
    expect(result).toHaveLength(0);
  });

  it('accepts a normal public HTTP URL', async () => {
    const result = await errors('http://example.com/');
    expect(result).toHaveLength(0);
  });

  it('rejects a URL with no protocol', async () => {
    const result = await errors('example.com');
    expect(result.length).toBeGreaterThan(0);
  });

  it('rejects the cloud metadata endpoint 169.254.169.254', async () => {
    const result = await errors('http://169.254.169.254/latest/meta-data/');
    expect(result.length).toBeGreaterThan(0);
  });

  it('rejects a loopback IPv4 address 127.0.0.1', async () => {
    const result = await errors('http://127.0.0.1/');
    expect(result.length).toBeGreaterThan(0);
  });

  it('rejects a loopback address 127.x.x.x', async () => {
    const result = await errors('http://127.0.0.2/secret');
    expect(result.length).toBeGreaterThan(0);
  });

  it('rejects a private 10.x.x.x address', async () => {
    const result = await errors('http://10.0.0.1/internal');
    expect(result.length).toBeGreaterThan(0);
  });

  it('rejects a private 172.16.x.x address', async () => {
    const result = await errors('http://172.16.0.1/');
    expect(result.length).toBeGreaterThan(0);
  });

  it('rejects a private 192.168.x.x address', async () => {
    const result = await errors('http://192.168.1.1/admin');
    expect(result.length).toBeGreaterThan(0);
  });

  it('rejects a link-local IPv4 address 169.254.x.x', async () => {
    const result = await errors('http://169.254.1.1/');
    expect(result.length).toBeGreaterThan(0);
  });

  it('rejects the IPv6 loopback ::1', async () => {
    const result = await errors('http://[::1]/');
    expect(result.length).toBeGreaterThan(0);
  });

  it('rejects an IPv6 link-local address fe80::1', async () => {
    const result = await errors('http://[fe80::1]/');
    expect(result.length).toBeGreaterThan(0);
  });

  it('rejects an IPv6 unique-local address fc00::1', async () => {
    const result = await errors('http://[fc00::1]/');
    expect(result.length).toBeGreaterThan(0);
  });

  it('rejects an IPv4-mapped IPv6 address pointing to 127.0.0.1', async () => {
    const result = await errors('http://[::ffff:127.0.0.1]/');
    expect(result.length).toBeGreaterThan(0);
  });

  it('rejects an IPv4-mapped IPv6 address pointing to 10.0.0.1', async () => {
    const result = await errors('http://[::ffff:10.0.0.1]/');
    expect(result.length).toBeGreaterThan(0);
  });

  it('rejects a javascript: scheme URL', async () => {
    const result = await errors('javascript:alert(1)');
    expect(result.length).toBeGreaterThan(0);
  });

  it('rejects a ftp: scheme URL', async () => {
    const result = await errors('ftp://example.com/file');
    expect(result.length).toBeGreaterThan(0);
  });
});
