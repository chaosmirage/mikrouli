import { useTranslation } from 'react-i18next';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import CopyControl from '../components/CopyControl';

// The connect surface: one statement head, the credential's terms and the
// machine's terms as labeled rows in the technical register, and one takeable
// example call. Everything a machine needs to connect, nothing a human has to
// read twice -- the register's credibility is the calm.

// The page zone: the whole content zone at the standing page inset, so the
// head, the ruled rows, and the example all stand where the reference frame
// places them.
const ZONE_SX = { px: { xs: 3, md: 15 } } as const;

const PAGE_SX = { pt: { xs: 3, md: 7 }, pb: { xs: 8, md: 10 } } as const;

/** The label column's width: the value's standing edge inside the zone. */
const LABEL_COLUMN = 280;

// One F4 labeled row: the standing label in the row register, the machine
// value beside it in the fixed-width register, a hairline rule closing the
// row. The label holds a fixed column so every value starts on one edge and
// comparable terms compare as one register.
const TERM_ROW_SX = {
  py: 1.75,
  display: 'flex',
  alignItems: 'baseline',
  columnGap: { xs: 2, md: 0 },
  flexDirection: { xs: 'column', md: 'row' },
} as const;

const TERM_LABEL_SX = {
  width: { xs: 'auto', md: `${LABEL_COLUMN}px` },
  flexShrink: 0,
  color: 'ink.muted',
  lineHeight: 1.5,
} as const;

// The takeable example: the exact text on the raised ground inside a hairline
// edge, the take standing flush at its right end -- one activation puts it on
// the clipboard, no transcription by hand.
const EXAMPLE_BLOCK_SX = {
  mt: 3,
  p: 3,
  pb: 4,
  backgroundColor: 'surface.raised',
  border: '1px solid',
  borderColor: 'line.hairline',
  borderRadius: 1,
} as const;

const EXAMPLE_TEXT_SX = {
  flex: '1 1 auto',
  minWidth: 0,
  whiteSpace: 'pre' as const,
  overflowX: 'auto' as const,
} as const;

// One connected call, stated exactly as it is taken.
const MCP_CURL_EXAMPLE = `curl -X POST https://mikrou.li/api/mcp \\
  -H "x-api-key: $MIKROULI_KEY" \\
  -d '{"url": "https://example.com/launch"}'`;

// --- Data structures ---------------------------------------------------------

/** One machine term as the surface states it: a standing label in the
 *  product's register and the machine value that stands beside it. */
interface MachineTerm {
  label: string;
  value: string;
}

interface TermSectionProps {
  testId: string;
  terms: readonly MachineTerm[];
}

/**
 * The credential's terms and the machine's terms rendered through one row
 * shape: every row is a label, a value in the technical register, and the
 * hairline that closes it, so the two sections read as one register.
 */
function TermSection({ testId, terms }: TermSectionProps) {
  return (
    <Box data-testid={testId}>
      {terms.map((term) => (
        <Box key={term.label}>
          <Box sx={TERM_ROW_SX}>
            <Typography variant="overline" component="span" sx={TERM_LABEL_SX}>
              {term.label}
            </Typography>
            <Typography variant="technical" component="span">
              {term.value}
            </Typography>
          </Box>
          <Divider />
        </Box>
      ))}
    </Box>
  );
}

/** The statement head: what connecting is, in one line of description. */
function ConnectionStatement() {
  const { t } = useTranslation('connect');
  return (
    <Stack spacing={1.75}>
      <Typography variant="h3" component="h1">
        {t('pageTitle')}
      </Typography>
      <Typography variant="body1" color="text.secondary">
        {t('pageDescription')}
      </Typography>
    </Stack>
  );
}

export default function ConnectPage() {
  const { t } = useTranslation('connect');

  // The credential's terms: where the credential is issued and how it is
  // named. Machine values stay in their own register, never translated.
  const credentialTerms: readonly MachineTerm[] = [
    { label: t('apiKeyLabel'), value: t('apiKeyValue') },
    { label: t('headerLabel'), value: 'x-api-key: mk_…' },
    { label: t('keyFormatLabel'), value: 'mk_ + 32 base62 chars' },
  ];

  // The machine's terms: where the protocol listens and what it speaks.
  const machineTerms: readonly MachineTerm[] = [
    { label: t('endpointLabel'), value: 'https://mikrou.li/api/mcp' },
    { label: t('protocolLabel'), value: t('protocolValue') },
  ];

  return (
    <Box component="main" data-testid="connect-page" sx={PAGE_SX}>
      <Box sx={ZONE_SX}>
        <Stack spacing={7}>
          <ConnectionStatement />
          <Stack spacing={3}>
            <TermSection testId="connect-credential-terms" terms={credentialTerms} />
            <TermSection testId="connect-machine-terms" terms={machineTerms} />
            <Box sx={EXAMPLE_BLOCK_SX} data-testid="connect-example-mcp">
              <Stack direction="row" spacing={2} alignItems="flex-start">
                <Typography variant="technical" component="div" sx={EXAMPLE_TEXT_SX}>
                  {MCP_CURL_EXAMPLE}
                </Typography>
                <CopyControl value={MCP_CURL_EXAMPLE} testId="copy-mcp-call" label="copy" />
              </Stack>
            </Box>
          </Stack>
        </Stack>
      </Box>
    </Box>
  );
}
