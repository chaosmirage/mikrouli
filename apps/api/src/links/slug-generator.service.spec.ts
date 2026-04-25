import { ModuleMetadata } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { SlugGeneratorService, ALPHABET, SLUG_LENGTH } from './slug-generator.service';

const moduleMetadata: ModuleMetadata = {
  providers: [SlugGeneratorService],
};

describe('SlugGeneratorService', () => {
  let service: SlugGeneratorService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule(moduleMetadata).compile();
    service = module.get<SlugGeneratorService>(SlugGeneratorService);
  });

  it('generate() returns a string of exactly SLUG_LENGTH characters', () => {
    const slug = service.generate();
    expect(slug).toHaveLength(SLUG_LENGTH);
  });

  it('generate() uses only characters from ALPHABET', () => {
    const alphabetSet = new Set(ALPHABET.split(''));
    const slug = service.generate();
    expect(slug.split('').every((char) => alphabetSet.has(char))).toBe(true);
  });

  it('generate() produces diverse output across 100 calls', () => {
    const slugs = new Set(Array.from({ length: 100 }, () => service.generate()));
    expect(slugs.size).toBeGreaterThan(90);
  });

  it('ALPHABET length is exactly 61', () => {
    expect(ALPHABET).toHaveLength(61);
  });

  it('ALPHABET excludes uppercase O and I but keeps all 26 lowercase', () => {
    expect(ALPHABET).not.toContain('O');
    expect(ALPHABET).not.toContain('I');
    expect(ALPHABET).toContain('l');
    expect(ALPHABET).toContain('I'.toLowerCase());
  });

  it('generate() draws only from ALPHABET across 1000 samples', () => {
    const alphabetSet = new Set(ALPHABET.split(''));
    const slugs = Array.from({ length: 1000 }, () => service.generate());
    const allChars = slugs.join('').split('');
    expect(allChars.every((c) => alphabetSet.has(c))).toBe(true);
  });

  it('generate() never invokes Math.random', () => {
    const spy = jest.spyOn(Math, 'random');
    Array.from({ length: 100 }, () => service.generate());
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
