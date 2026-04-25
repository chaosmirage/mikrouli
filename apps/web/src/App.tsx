import Container from '@mui/material/Container';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';

const heading = <Typography variant="h3">mikrouli</Typography>;
const subhead = (
  <Typography color="text.secondary">URL shortener — bootstrap phase</Typography>
);
const cta = <Button variant="contained">Primary action</Button>;
const stack = <Stack spacing={3}>{heading}{subhead}{cta}</Stack>;
const box = <Box sx={{ py: 8 }}>{stack}</Box>;
const root = (
  <Container maxWidth="sm" data-testid="app-root">
    {box}
  </Container>
);

export default function App() {
  return root;
}
