import { useCallback, useEffect, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';

const URL_INPUT_PROPS = { 'data-testid': 'edit-url-input' } as const;

export interface EditLinkDialogProps {
  open: boolean;
  slug: string;
  currentUrl: string;
  onConfirm: (url: string) => void;
  onCancel: () => void;
  loading?: boolean;
  error?: string;
}

export default function EditLinkDialog({
  open,
  slug,
  currentUrl,
  onConfirm,
  onCancel,
  loading = false,
  error,
}: EditLinkDialogProps) {
  const { t } = useTranslation('dashboard');
  const { t: tCommon } = useTranslation('common');
  const inputId = useId();
  const [url, setUrl] = useState(currentUrl);

  // The dialog is a single, reusable instance shared across rows; reset the
  // draft to the row's current destination whenever it opens for a new link.
  useEffect(() => {
    if (open) setUrl(currentUrl);
  }, [open, currentUrl]);

  const handleConfirm = useCallback(() => onConfirm(url), [onConfirm, url]);
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setUrl(e.target.value),
    [],
  );

  return (
    <Dialog open={open} onClose={onCancel} data-testid="edit-dialog">
      <DialogTitle data-testid="edit-dialog-title">{t('editLink')}</DialogTitle>
      <DialogContent>
        <TextField
          id={inputId}
          label={t('newDestination')}
          value={url}
          onChange={handleChange}
          helperText={error ?? t('editLinkBody', { slug })}
          error={!!error}
          fullWidth
          margin="dense"
          inputProps={URL_INPUT_PROPS}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel} data-testid="edit-cancel">
          {tCommon('cancel')}
        </Button>
        <Button
          onClick={handleConfirm}
          color="primary"
          variant="contained"
          disabled={loading}
          data-testid="edit-confirm"
        >
          {tCommon('save')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
