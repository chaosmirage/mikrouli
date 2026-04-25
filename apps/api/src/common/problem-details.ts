export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  errors?: Array<{ field: string; message: string; rule: string }>;
}

const PROBLEM_BASE_URI = 'https://mikrou.li/problems';

const STATUS_SLUG_MAP: Record<number, string> = {
  400: 'bad-request',
  401: 'unauthorized',
  403: 'forbidden',
  404: 'not-found',
  409: 'conflict',
  410: 'gone',
  422: 'validation',
  500: 'internal-server-error',
};

export function problemTypeUri(slug: string): string {
  return `${PROBLEM_BASE_URI}/${slug}`;
}

export function buildProblem(
  status: number,
  typeSlug: string,
  title: string,
  detail?: string,
): ProblemDetails {
  return {
    type: problemTypeUri(typeSlug),
    title,
    status,
    ...(detail !== undefined ? { detail } : {}),
  };
}

export function buildProblemFromStatus(status: number, detail?: string): ProblemDetails {
  const slug = STATUS_SLUG_MAP[status] ?? 'unknown';
  const title = slug
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
  return buildProblem(status, slug, title, detail);
}
