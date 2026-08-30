import { useTranslation } from 'react-i18next';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
  dialogTestId?: string;
  titleTestId?: string;
  cancelTestId?: string;
  confirmTestId?: string;
}

export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  onConfirm,
  onCancel,
  loading = false,
  dialogTestId,
  titleTestId,
  cancelTestId,
  confirmTestId,
}: ConfirmDialogProps) {
  const { t } = useTranslation('common');
  return (
    <Dialog open={open} onClose={onCancel} data-testid={dialogTestId}>
      <DialogTitle data-testid={titleTestId}>{title}</DialogTitle>
      <DialogContent>
        <Typography>{description}</Typography>
      </DialogContent>
      <DialogActions sx={{ justifyContent: 'flex-start', px: 3, pb: 2 }}>
        <Button
          onClick={onConfirm}
          color="secondary"
          variant="contained"
          disabled={loading}
          data-testid={confirmTestId}
        >
          {confirmLabel}
        </Button>
        <Button onClick={onCancel} data-testid={cancelTestId} sx={{ color: 'ink.secondary' }}>
          {t('cancel')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
