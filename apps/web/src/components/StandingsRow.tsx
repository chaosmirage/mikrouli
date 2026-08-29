import { ReactNode } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

// One labeled-standings row: the shared row shape for every surface that
// compares standings — the dashboard's link set, the stats breakdowns, the
// capability standings. Labels name each standing; values align through
// tabular numerals so like-positioned values compare across rows.

export interface Standing {
  label: string;
  value: ReactNode;
  testId?: string;
}

export interface StandingsRowProps {
  // The row's identity matter (the dashboard's takeable short link). At
  // narrow widths the standings wrap into a cluster under it.
  identity?: ReactNode;
  standings: Standing[];
  // The row's act reaches, kept inside the row they act on.
  acts?: ReactNode;
  rowTestId?: string;
}

const ROW_SX = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  columnGap: 3,
  rowGap: 1.5,
  width: '100%',
  py: 1.5,
} as const;

const STANDINGS_SX = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  columnGap: 3,
  rowGap: 1,
  minWidth: 0,
} as const;

const STANDING_SX = { minWidth: 0 } as const;

// Labels are standings-and-metadata matter (ink.muted); values are sustained
// reading ink with tabular numerals so values compare like-positioned.
const LABEL_SX = { color: 'ink.muted' } as const;

const VALUE_SX = {
  color: 'ink.primary',
  fontVariantNumeric: 'tabular-nums',
  wordBreak: 'break-word',
} as const;

const ACTS_SX = { display: 'flex', alignItems: 'center', gap: 0.5, marginLeft: 'auto' } as const;

export default function StandingsRow({ identity, standings, acts, rowTestId }: StandingsRowProps) {
  return (
    <Box sx={ROW_SX} data-testid={rowTestId}>
      {identity}
      <Stack direction="row" sx={STANDINGS_SX} useFlexGap>
        {standings.map((standing) => (
          <Box key={standing.label} sx={STANDING_SX} data-testid={standing.testId}>
            <Typography variant="body2" sx={LABEL_SX}>
              {standing.label}
            </Typography>
            {/* component="div": a standing's value may be block matter (the
                dashboard's in-row correction form), which must not nest
                inside a paragraph element. */}
            <Typography component="div" sx={VALUE_SX}>
              {standing.value}
            </Typography>
          </Box>
        ))}
      </Stack>
      {acts ? <Box sx={ACTS_SX}>{acts}</Box> : null}
    </Box>
  );
}
