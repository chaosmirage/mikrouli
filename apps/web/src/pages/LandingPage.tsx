import { useCallback, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { Link as RouterLink } from 'react-router-dom';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Link from '@mui/material/Link';
import ShortenCard from '../components/ShortenCard';
import { useAuth } from '../auth/AuthContext';
import { useGuestShortenEnabled } from '../hooks/useGuestShortenEnabled';
import type { PublicLink } from '../api/types';

// The landing is the one full-viewport composition: it stands outside the
// contained width and composes on the thirds — the display statement at the
// upper third-line intersection, the act inside the same glance, the claims
// band in the next downward glance. Spacing follows the five-step space ladder
// over the theme's base unit (inline = 1, element = 2, block = 3, zone = 5).

// The composition's left margin: the content column opens 120px into the
// viewport at desktop widths (the full-viewport landing's own margin rhythm).
const CONTENT_GUTTER_SX = {
  px: { xs: 3, md: 15 },
  minHeight: 'calc(100vh - 64px)',
  display: 'flex',
  flexDirection: 'column',
} as const;

// The display statement: the first-sight statement at the display step,
// weight-led and tightened, in the strongest ink directly on the canvas. The
// frame (S1-B1, 5:50) sets 96/112 on the line box, so the display's lower
// edge lands on the upper third-line (300px of the 900px viewport).
const STATEMENT_TITLE_SX = {
  color: 'text.primary',
  fontWeight: 800,
  letterSpacing: '-0.03em',
  lineHeight: { xs: '44px', sm: '62px', md: '112px' },
  fontSize: { xs: '2.5rem', sm: '3.5rem', md: '6rem' },
} as const;

const STATEMENT_SUPPORT_SX = {
  color: 'text.secondary',
  maxWidth: 640,
  mt: 1,
} as const;

// The one-act row: the entering and the confirm side by side, one glance below
// the statement. Frame register (S1-B2): the act family opens 72px below the
// support line's foot — the next downward glance, not a new zone.
const ACT_SECTION_SX = { mt: 9, maxWidth: 640 } as const;

// The act family's own geometry, scoped to the landing act because the shared
// ShortenCard serves both hosts. Frame register (S1-B2): the entering is a
// 520px field on the raised surface with the hairline edge and the 14px inner
// register, the confirm a 40px pill; the shared control heights and the
// field's inner register belong to the form system's owner.
const ACT_FAMILY_SX = {
  '& .MuiFormControl-root': { width: { xs: '100%', sm: '520px' }, flex: { sm: '0 0 auto' } },
  '& .MuiButton-root': { height: 40, fontSize: '0.875rem' },
  '& .MuiOutlinedInput-root': { backgroundColor: 'surface.raised' },
  '& .MuiInputBase-input': { fontSize: '0.875rem' },
  '& .MuiInputLabel-root': { fontSize: '0.875rem', color: 'text.disabled' },
  '& .MuiFormLabel-asterisk': { display: 'none' },
  // The entering reads as an in-field placeholder in the muted ink (frame
  // S1-B2), never a notched label: the field's hairline edge stays closed.
  '& .MuiInputBase-input::placeholder': { color: 'text.disabled', opacity: 1 },
} as const;

const ACT_ROW_SX = {
  flexDirection: { xs: 'column', sm: 'row' },
  gap: 2,
  alignItems: { sm: 'center' },
} as const;

// The resolved-failure statement: its standing place is one inline step below
// the act family (frame S1-B2, 5:57 at 456px), so the eye that misses the
// confirm lands on the failure the moment it appears.
const FAILURE_POSITION_SX = { mt: 1.5, color: 'text.disabled', fontSize: '0.75rem' } as const;

// The claims band stands in its own downward glance, a full zone-plus below the
// act family (frame S1-B3: the band's claim lines open at 576px, 100px below
// the failure statement's foot), so the act is never scanned past.
const CLAIMS_SECTION_SX = { mt: 12.5 } as const;

// One band of four equal columns: the frame's 280px columns at a 320px pitch
// (element gap), the band spanning 1240px of the 1440 viewport.
const CLAIMS_GRID_SX = {
  display: 'grid',
  gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 280px)' },
  columnGap: 5,
  rowGap: 4,
  width: { md: '1240px' },
} as const;

// Comparable claims look comparable: every entry is the identical shape — one
// claim line at the body register, one comparate line at the meta register in
// the muted ink, an optional reach in the accent — differing only in content.
const CLAIM_TITLE_SX = { color: 'text.primary' } as const;
// The comparate reads at the frame's 12px meta step (S1-B3), pinned here so
// the register stays exact on this surface whatever the shared step becomes.
const CLAIM_COMPARATE_SX = { color: 'text.disabled', mt: 0.5, fontSize: '0.75rem' } as const;
const CLAIM_REACH_SX = { color: 'primary.main', fontSize: '0.75rem', mt: 1.5 } as const;

// The footer's legal pair stands at the foot in the meta register (frame 5:68:
// 28px above the viewport foot), separated by the band's own interpunct.
const FOOTER_SX = { mt: 'auto', pb: 3.5 } as const;
const FOOTER_LINK_SX = { color: 'text.disabled', fontSize: '0.75rem' } as const;
const FOOTER_MARK_SX = { color: 'text.disabled', fontSize: '0.75rem' } as const;

// --- The create-result moment (frame S2) ------------------------------------------
//
// The frame stages the guest's result as the page's whole composition (S2 is
// shell + confirmation + take + code cluster + register offer, nothing else):
// the moment opens 66px below the shell so the confirmation's line box lands at
// the frame's 130px, and the section gives up the act column's 640px bound for
// the full 1200px content zone the moment composes on.
const MOMENT_PAGE_SX = {
  pt: { xs: 4, md: '66px' },
  bgcolor: 'background.default',
  flex: '1 1 auto',
  display: 'flex',
  flexDirection: 'column',
} as const;
const MOMENT_SECTION_SX = { width: '100%' } as const;

// The register offer (frame S2-B4): ONE raised band inside the moment, never a
// veil over it — the statement pair left, the two acts right (the accept in the
// accent, the decline as its plain reach), one zone step under the code
// cluster's foot (frame 5:301: the band opens at 584px, 74px under the pair).
const OFFER_BAND_SX = {
  mt: { xs: 5, md: '74px' },
  backgroundColor: 'surface.raised',
  borderRadius: 2,
  minHeight: { md: '120px' },
  pl: { xs: 2.5, md: '32px' },
  pr: { xs: 2.5, md: '24px' },
  py: { xs: 2.5, md: 0 },
  display: 'flex',
  flexDirection: { xs: 'column', md: 'row' },
  alignItems: { xs: 'flex-start', md: 'center' },
  justifyContent: 'space-between',
  gap: { xs: 3, md: 5 },
} as const;
// The statement pair opens 24px under the band's top edge (frame 5:301: title
// at 608 in the 584..704 band) while the acts center on the band's middle.
const OFFER_TEXT_SX = {
  alignSelf: { md: 'flex-start' },
  pt: { xs: 0, md: '24px' },
} as const;
const OFFER_TITLE_SX = { color: 'text.primary' } as const;
// The offer's statement pair reads at the frame's registers (S2-B4: title 16,
// support 12) with the two acts at the act family's 40px height and 14px step.
const OFFER_SUPPORT_SX = { color: 'text.disabled', mt: '14px', fontSize: '0.75rem' } as const;
const OFFER_ACT_SX = { height: 40, fontSize: '0.875rem', whiteSpace: 'nowrap' } as const;
const OFFER_DECLINE_SX = { height: 40, fontSize: '0.875rem', whiteSpace: 'nowrap' } as const;

interface ClaimReach {
  labelKey: string;
  to: string;
}

interface ClaimEntry {
  id: string;
  titleKey: string;
  comparateKey: string;
  reach?: ClaimReach;
}

// The free-capability claims, each naming its compared analog so the visitor
// chooses by seeing, not researching. The agent entry carries its reach to the
// connect surface, where that differentiator lives.
const CLAIMS: readonly ClaimEntry[] = [
  {
    id: 'analytics',
    titleKey: 'claimAnalyticsTitle',
    comparateKey: 'claimAnalyticsComparate',
  },
  { id: 'qr', titleKey: 'claimQrTitle', comparateKey: 'claimQrComparate' },
  {
    id: 'agents',
    titleKey: 'claimAgentsTitle',
    comparateKey: 'claimAgentsComparate',
    reach: { labelKey: 'claimAgentsReach', to: '/connect' },
  },
  {
    id: 'languages',
    titleKey: 'claimLanguagesTitle',
    comparateKey: 'claimLanguagesComparate',
  },
];

function ClaimEntryBlock({ claim }: { claim: ClaimEntry }) {
  const { t } = useTranslation('landing');
  return (
    <Stack data-testid={`landing-claim-${claim.id}`}>
      <Typography variant="body2" sx={CLAIM_TITLE_SX}>
        {t(claim.titleKey)}
      </Typography>
      <Typography variant="caption" sx={CLAIM_COMPARATE_SX}>
        {t(claim.comparateKey)}
      </Typography>
      {claim.reach && (
        <Link
          component={RouterLink}
          to={claim.reach.to}
          underline="hover"
          data-testid={`landing-claim-${claim.id}-reach`}
          sx={CLAIM_REACH_SX}
        >
          {t(claim.reach.labelKey)}
        </Link>
      )}
    </Stack>
  );
}

// The first-sight statement: what the product is, in the strongest ink
// directly on the canvas — no card, no illustration, no gradient.
function FirstSightStatement() {
  const { t } = useTranslation('landing');
  return (
    <Box component="section" data-testid="landing-statement">
      <Typography variant="h1" component="h1" sx={STATEMENT_TITLE_SX}>
        {t('statementTitle')}
      </Typography>
      <Typography variant="body1" sx={STATEMENT_SUPPORT_SX}>
        {t('statementSupport')}
      </Typography>
    </Box>
  );
}

// The free-capability claims band: one band of four comparable entries in the
// glance below the act.
function ClaimsBand() {
  return (
    <Box component="section" data-testid="landing-claims" sx={CLAIMS_SECTION_SX}>
      <Box sx={CLAIMS_GRID_SX}>
        {CLAIMS.map((claim) => (
          <ClaimEntryBlock key={claim.id} claim={claim} />
        ))}
      </Box>
    </Box>
  );
}

// The register offer band: the ask that stands AFTER the value. Declining
// costs nothing — the moment keeps everything it granted — so the decline is
// one act that retires the band alone.
function RegisterOfferBand({ onDecline }: { onDecline: () => void }) {
  const { t } = useTranslation('landing');
  return (
    <Paper elevation={0} data-testid="guest-nudge" sx={OFFER_BAND_SX}>
      <Box sx={OFFER_TEXT_SX}>
        <Typography variant="body" component="div" sx={OFFER_TITLE_SX}>
          {t('guestOfferTitle')}
        </Typography>
        <Typography variant="meta" component="div" sx={OFFER_SUPPORT_SX}>
          <Trans
            i18nKey="guestOfferSupport"
            t={t}
            components={{
              kept: <span data-testid="guest-nudge-feature-kept-link" />,
              dashboard: <span data-testid="guest-nudge-feature-dashboard" />,
              agents: <span data-testid="guest-nudge-feature-api-keys" />,
            }}
          />
        </Typography>
      </Box>
      <Stack direction="row" spacing={2} alignItems="center">
        <Button
          component={RouterLink}
          to="/register"
          variant="contained"
          color="primary"
          data-testid="guest-nudge-cta"
          sx={OFFER_ACT_SX}
        >
          {t('guestOfferAccept')}
        </Button>
        <Button color="primary" onClick={onDecline} data-testid="guest-nudge-decline" sx={OFFER_DECLINE_SX}>
          {t('guestOfferDecline')}
        </Button>
      </Stack>
    </Paper>
  );
}

// Renders the guest shorten act and, once a link exists, the create-result
// moment with its register offer. Only visible to anonymous visitors
// (useAuth().user === null) AND only when the runtime GUEST_SHORTEN_ENABLED
// flag is on (read via /config.js); loading and disabled both hide the act, so
// the form never flashes and stays hidden fail-safe on misconfiguration. The
// offer appears AFTER a successful guest shorten — the ask always stands after
// the value — and declines retire the band alone.
function GuestShortenSection({ onMoment }: { onMoment: () => void }) {
  const { t } = useTranslation('landing');
  const { user } = useAuth();
  const flag = useGuestShortenEnabled();
  const [momentLink, setMomentLink] = useState<PublicLink | null>(null);
  const [offerDeclined, setOfferDeclined] = useState(false);

  const handleShortened = useCallback(
    (link: PublicLink) => {
      setMomentLink(link);
      onMoment();
    },
    [onMoment],
  );

  const handleDecline = useCallback(() => setOfferDeclined(true), []);

  if (user !== null || flag !== 'enabled') return null;

  if (momentLink) {
    return (
      <Box component="section" data-testid="guest-shorten-section" sx={MOMENT_SECTION_SX}>
        <Box sx={ACT_ROW_SX}>
          <ShortenCard namespace="landing" onShortened={handleShortened} bare />
        </Box>
        {!offerDeclined && <RegisterOfferBand onDecline={handleDecline} />}
      </Box>
    );
  }

  return (
    <Box component="section" data-testid="guest-shorten-section" sx={[ACT_SECTION_SX, ACT_FAMILY_SX]}>
      <Box sx={ACT_ROW_SX}>
        <ShortenCard namespace="landing" onShortened={handleShortened} bare />
      </Box>
      <Typography variant="caption" sx={FAILURE_POSITION_SX}>
        {t('failurePosition')}
      </Typography>
    </Box>
  );
}

// The footer's legal reaches stand at the landing's foot like on every shell
// surface (the shell carries them on protected routes; the full-viewport
// landing carries its own pair).
function LandingFooter() {
  const { t } = useTranslation('landing');
  return (
    <Box component="footer" sx={FOOTER_SX}>
      <Stack direction="row" spacing={1} alignItems="center">
        <Link
          component={RouterLink}
          to="/terms"
          underline="hover"
          sx={FOOTER_LINK_SX}
          data-testid="footer-terms"
        >
          {t('footerTerms')}
        </Link>
        <Typography component="span" sx={FOOTER_MARK_SX}>
          ·
        </Typography>
        <Link
          component={RouterLink}
          to="/privacy"
          underline="hover"
          sx={FOOTER_LINK_SX}
          data-testid="footer-privacy"
        >
          {t('footerPrivacy')}
        </Link>
      </Stack>
    </Box>
  );
}

export default function LandingPage() {
  // The first-sight composition and the create-result moment are two states of
  // one page: once the guest's link exists, the moment IS the composition (the
  // statement, the claims band, and the footer stand down), so the page's slot
  // structure stays fixed while only the moment's stage padding changes.
  const [momentActive, setMomentActive] = useState(false);

  const handleMoment = useCallback(() => setMomentActive(true), []);

  return (
    <Box component="main" data-testid="landing-page" sx={CONTENT_GUTTER_SX}>
      <Box sx={momentActive ? MOMENT_PAGE_SX : PAGE_PT_SX}>
        {!momentActive && <FirstSightStatement />}
        <GuestShortenSection onMoment={handleMoment} />
        {!momentActive && <ClaimsBand />}
        {!momentActive && <LandingFooter />}
      </Box>
    </Box>
  );
}

// The composition's upper anchor: the page opens 124px below the shell (frame
// register), placing the display's lower edge on the upper third-line.
const PAGE_PT_SX = {
  pt: { xs: 6, md: 15.5 },
  bgcolor: 'background.default',
  flex: '1 1 auto',
  display: 'flex',
  flexDirection: 'column',
} as const;
