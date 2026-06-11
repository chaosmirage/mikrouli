import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Reads the committed k8s manifest as text and asserts the observable
// security properties of credential delivery in the backup CronJob.
const CRONJOB_PATH = join(__dirname, '../../../k8s/base/clickhouse/backup-cronjob.yaml');

function loadManifest(): string {
  return readFileSync(CRONJOB_PATH, 'utf8');
}

describe('backup CronJob manifest — credential delivery', () => {
  let yaml: string;

  beforeAll(() => {
    yaml = loadManifest();
  });

  it('does not pass S3_ACCESS_KEY as a literal shell argument', () => {
    // Credentials in argv leak into /proc/<pid>/cmdline and process-list tools.
    expect(yaml).not.toContain("'$S3_ACCESS_KEY'");
  });

  it('does not pass S3_SECRET_KEY as a literal shell argument', () => {
    expect(yaml).not.toContain("'$S3_SECRET_KEY'");
  });

  it('does not use envFrom bulk secret mount', () => {
    // envFrom mounts every key from the secret into the pod — too broad.
    // Per-key secretKeyRef is required so each pod receives only its own keys.
    expect(yaml).not.toContain('envFrom:');
  });

  it('sources S3_ACCESS_KEY from a secretKeyRef', () => {
    expect(yaml).toContain('name: S3_ACCESS_KEY');
    expect(yaml).toContain('key: S3_ACCESS_KEY');
  });

  it('sources S3_SECRET_KEY from a secretKeyRef', () => {
    expect(yaml).toContain('name: S3_SECRET_KEY');
    expect(yaml).toContain('key: S3_SECRET_KEY');
  });

  it('sources CLICKHOUSE_PASSWORD from a secretKeyRef', () => {
    expect(yaml).toContain('name: CLICKHOUSE_PASSWORD');
    expect(yaml).toContain('key: CLICKHOUSE_PASSWORD');
  });

  it('delivers the BACKUP statement via stdin rather than --query flag', () => {
    // Using --query with an inline string passes credentials in the process
    // argument list. Piping via --queries-file /dev/stdin keeps them in the
    // environment only.
    expect(yaml).not.toContain('--query');
    expect(yaml).toContain('--queries-file');
  });
});
