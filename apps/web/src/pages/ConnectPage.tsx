import { useTranslation } from 'react-i18next';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import Link from '@mui/material/Link';
import type { Theme } from '@mui/material/styles';
import CopyControl from '../components/CopyControl';
import StandingsRow from '../components/StandingsRow';

const PAGE_SX = { py: { xs: 4, md: 8 } } as const;

const SECTION_SX = {
  p: { xs: 3, md: 4 },
} as const;

const LIST_SX = { pl: 3, m: 0 } as const;

// The machine strings read in the theme's fixed-width register: a
// character-exact string must be read character-exactly, because a mistyped
// key or address fails late. (The optional chain keeps the strings legible
// under a theme that predates the register.)
const CODE_SX = {
  fontFamily: (theme: Theme) => theme.typography.technical?.fontFamily,
  fontSize: '0.875rem',
  bgcolor: 'action.hover',
  px: 1,
  py: 0.25,
  borderRadius: 0.5,
  display: 'inline',
} as const;

const CODE_BLOCK_SX = {
  fontFamily: (theme: Theme) => theme.typography.technical?.fontFamily,
  fontSize: '0.8125rem',
  bgcolor: 'action.hover',
  p: 2,
  borderRadius: 1,
  whiteSpace: 'pre' as const,
  overflowX: 'auto' as const,
  minWidth: 0,
} as const;

const EXAMPLE_BLOCK_ROW_SX = { alignItems: 'flex-start' } as const;

const REST_CURL_EXAMPLE = `curl -s -X POST https://mikrou.li/api/urls \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: mk_<your-key>" \\
  -d '{"url":"https://example.com/long-url"}' | jq .`;

const REST_RESPONSE_EXAMPLE = `{
  "shortUrl": "abc123",
  "originalUrl": "https://example.com/long-url",
  "createdAt": "2026-01-01T00:00:00.000Z",
  "expiresAt": null
}`;

const MCP_EXAMPLE = `curl -s -X POST https://mikrou.li/api/mcp \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: mk_<your-key>" \\
  -d '{
    "jsonrpc": "2.0",
    "method": "initialize",
    "id": 1,
    "params": {
      "protocolVersion": "2024-11-05",
      "capabilities": {},
      "clientInfo": { "name": "my-agent", "version": "1" }
    }
  }'`;

// Exact verified command for wiring mikrouli into Claude Code as an MCP server.
// --scope user: persists across projects; --transport http: Streamable HTTP.
const CLAUDE_MCP_ADD_COMMAND = `claude mcp add --scope user --transport http mikrouli \\
  https://mikrou.li/api/mcp \\
  --header "x-api-key: mk_<your-key>"`;

interface ExampleCallProps {
  label: string;
  command: string;
  testId: string;
  copyTestId: string;
}
/**
 * A takeable example call: the exact text stands in the technical register and
 * one activation takes it onto the clipboard, the landing confirmed beside it —
 * no transcription by hand.
 */
function ExampleCall({ label, command, testId, copyTestId }: ExampleCallProps) {
  return (
    <Stack spacing={1}>
      <Typography variant="subtitle1" fontWeight={600}>
        {label}
      </Typography>
      <Stack direction="row" spacing={1} sx={EXAMPLE_BLOCK_ROW_SX}>
        <Box sx={CODE_BLOCK_SX} data-testid={testId}>
          {command}
        </Box>
        <CopyControl value={command} testId={copyTestId} />
      </Stack>
    </Stack>
  );
}

/** What connecting does, stated in the capability's own register. */
function ConnectionStatement() {
  const { t } = useTranslation('connect');
  return (
    <Stack spacing={1}>
      <Typography variant="h3" component="h1" fontWeight={700}>
        {t('pageTitle')}
      </Typography>
      <Typography variant="body1" color="text.secondary">
        {t('pageDescription')}
      </Typography>
      <Box>
        <Link href="/llms.txt" underline="hover" variant="body2">
          {t('llmsFileLink')}
        </Link>
      </Box>
    </Stack>
  );
}

/** Where the credential comes from and how it is borne on every machine call. */
function AuthorizationTerms() {
  const { t } = useTranslation('connect');
  return (
    <Paper variant="outlined" sx={SECTION_SX} data-testid="connect-apikey-section">
      <Stack spacing={2}>
        <Typography variant="h5" component="h2">
          {t('apiKeySectionTitle')}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {t('apiKeySectionDesc')}
        </Typography>
        <Box component="ol" sx={LIST_SX}>
          <Box component="li">
            <Typography variant="body2">{t('apiKeySignIn')}</Typography>
          </Box>
          <Box component="li">
            <Typography variant="body2">{t('apiKeyNavigate')}</Typography>
          </Box>
          <Box component="li">
            <Typography variant="body2">{t('apiKeyCreate')}</Typography>
          </Box>
        </Box>
        <StandingsRow
          standings={[
            {
              label: t('restAuthHeader'),
              value: (
                <Box component="span" sx={CODE_SX}>
                  x-api-key: mk_&lt;your-key&gt;
                </Box>
              ),
            },
            {
              label: t('keyFormatLabel'),
              value: (
                <Box component="span" sx={CODE_SX}>
                  mk_&lt;your-key&gt;
                </Box>
              ),
            },
          ]}
        />
        <Typography variant="body2" color="text.secondary">
          {t('apiKeyNote')}
        </Typography>
      </Stack>
    </Paper>
  );
}

/** The machine terms of the direct REST path: endpoint and example call. */
function RestTerms() {
  const { t } = useTranslation('connect');
  return (
    <Paper variant="outlined" sx={SECTION_SX} data-testid="connect-rest-section">
      <Stack spacing={2}>
        <Typography variant="h5" component="h2">
          {t('restSectionTitle')}
        </Typography>
        <Typography variant="subtitle1" fontWeight={600}>
          {t('restEndpoint')}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {t('restEndpointDesc')}
        </Typography>
        <ExampleCall
          label={t('exampleCallLabel')}
          command={REST_CURL_EXAMPLE}
          testId="connect-example-direct"
          copyTestId="copy-direct-call"
        />
        <Typography variant="body2" color="text.secondary">
          {t('restResponseDesc')}
        </Typography>
        <Box sx={CODE_BLOCK_SX}>{REST_RESPONSE_EXAMPLE}</Box>
      </Stack>
    </Paper>
  );
}

/** The machine terms of the MCP path: address, protocol, and harness wiring. */
function McpTerms() {
  const { t } = useTranslation('connect');
  return (
    <Paper variant="outlined" sx={SECTION_SX} data-testid="connect-mcp-section">
      <Stack spacing={2}>
        <Typography variant="h5" component="h2">
          {t('mcpSectionTitle')}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {t('mcpSectionDesc')}
        </Typography>
        <StandingsRow
          standings={[
            {
              label: t('mcpEndpoint'),
              value: (
                <Box component="span" sx={CODE_SX}>
                  /api/mcp
                </Box>
              ),
            },
          ]}
        />
        <Typography variant="body2" color="text.secondary">
          {t('mcpProtocol')}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {t('mcpAuthNote')}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {t('mcpToolDesc')}
        </Typography>
        <Box sx={CODE_BLOCK_SX}>{MCP_EXAMPLE}</Box>
        <Typography variant="subtitle1" fontWeight={600}>
          {t('mcpClaudeCodeTitle')}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {t('mcpClaudeCodeDesc')}
        </Typography>
        <ExampleCall
          label={t('exampleCallLabel')}
          command={CLAUDE_MCP_ADD_COMMAND}
          testId="connect-example-harness"
          copyTestId="copy-harness-add"
        />
      </Stack>
    </Paper>
  );
}

export default function ConnectPage() {
  return (
    <Box component="main" data-testid="connect-page">
      <Container maxWidth="sm" sx={PAGE_SX}>
        <Stack spacing={5}>
          <ConnectionStatement />
          <AuthorizationTerms />
          <RestTerms />
          <McpTerms />
        </Stack>
      </Container>
    </Box>
  );
}
