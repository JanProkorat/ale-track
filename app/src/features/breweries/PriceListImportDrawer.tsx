import { useEffect, useMemo, useState } from 'react';
import {
  Alert, Box, Button, Chip, Stack, Typography,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
} from '@mui/material';
import UploadFileIcon from '@mui/icons-material/UploadFileOutlined';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import dayjs, { type Dayjs } from 'dayjs';
import { useSnackbar } from 'notistack';
import { FormDrawer } from 'src/components/common/FormDrawer';
import { useCurrency } from 'src/providers/CurrencyProvider';
import { apiErrorMessage } from 'src/api/errors';
import { packagingLabel, priceListChangeLabel, priceListChangeName } from 'src/lib/labels';
import { plural } from 'src/lib/format';
import {
  PriceListChangeKind, type PriceListPreviewDto, type PriceListPreviewItemDto,
} from 'src/generated/api-client';
import { useApplyPriceList, usePreviewPriceList } from 'src/hooks/useBreweryProducts';

/** Buckets in the order the user should read them: what changes first, what is only reported last. */
const BUCKETS: PriceListChangeKind[] = [
  PriceListChangeKind.Added,
  PriceListChangeKind.Repriced,
  PriceListChangeKind.Changed,
  PriceListChangeKind.ToRemove,
  PriceListChangeKind.Blocked,
  PriceListChangeKind.Unchanged,
];

/** Colour by consequence, not by novelty: removal reads as destructive, blocked as a warning. */
const BUCKET_COLOR: Record<string, 'default' | 'success' | 'info' | 'warning' | 'error'> = {
  Added: 'success',
  Repriced: 'info',
  Changed: 'info',
  ToRemove: 'error',
  Blocked: 'warning',
  Unchanged: 'default',
};

function bucketCount(preview: PriceListPreviewDto, kind: PriceListChangeKind): number {
  const s = preview.summary;
  switch (kind) {
    case PriceListChangeKind.Added: return s?.added ?? 0;
    case PriceListChangeKind.Repriced: return s?.repriced ?? 0;
    case PriceListChangeKind.Changed: return s?.changed ?? 0;
    case PriceListChangeKind.ToRemove: return s?.toRemove ?? 0;
    case PriceListChangeKind.Blocked: return s?.blocked ?? 0;
    default: return s?.unchanged ?? 0;
  }
}

function changeSummary(item: PriceListPreviewItemDto): string {
  return (item.changes ?? [])
    .map((c) => `${c.before ?? '—'} → ${c.after ?? '—'}`)
    .join(', ');
}

/**
 * Upload a brewery's price list, review what it would do, then apply it.
 *
 * Two steps in one drawer on purpose: the preview's `sourceHash` is what the apply is checked
 * against, so the file being applied is provably the file that was reviewed. Changing either the
 * file or the effective date throws the preview away rather than letting a stale diff be applied.
 */
export function PriceListImportDrawer({
  open,
  breweryId,
  onClose,
}: {
  open: boolean;
  breweryId: string;
  onClose: () => void;
}) {
  const { enqueueSnackbar } = useSnackbar();
  const { formatMoney } = useCurrency();
  const previewList = usePreviewPriceList(breweryId);
  const applyList = useApplyPriceList(breweryId);

  const [file, setFile] = useState<File | null>(null);
  const [effectiveFrom, setEffectiveFrom] = useState<Dayjs | null>(dayjs());
  const [preview, setPreview] = useState<PriceListPreviewDto | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setFile(null);
    setEffectiveFrom(dayjs());
    setPreview(null);
  }, [open]);

  // Only rows the import would touch. Listing a hundred unchanged products would bury the ten
  // that actually move, and their count is already in the summary.
  const items = useMemo(
    () => (preview?.items ?? []).filter((i) => i.kind !== PriceListChangeKind.Unchanged),
    [preview],
  );

  const toRemoveCount = preview?.summary?.toRemove ?? 0;
  const blockedCount = preview?.summary?.blocked ?? 0;

  const fileParameter = () => ({ data: file!, fileName: file!.name });

  /**
   * The chosen calendar date as UTC midnight. The generated client serializes a form-field date
   * with `Date.toJSON()`, so a local midnight would cross back over the date line for any timezone
   * east of UTC and import the list as effective the day before.
   */
  const effectiveFromUtc = () => {
    const d = effectiveFrom!;
    return new Date(Date.UTC(d.year(), d.month(), d.date()));
  };

  const runPreview = async () => {
    setBusy(true);
    try {
      setPreview(await previewList.mutateAsync({
        file: fileParameter(),
        effectiveFrom: effectiveFromUtc(),
      }));
    } catch (e) {
      setPreview(null);
      enqueueSnackbar(apiErrorMessage(e, 'Ceník se nepodařilo načíst.'), { variant: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const runApply = async () => {
    setBusy(true);
    try {
      const result = await applyList.mutateAsync({
        file: fileParameter(),
        effectiveFrom: effectiveFromUtc(),
        sourceHash: preview!.sourceHash!,
      });
      enqueueSnackbar(
        `Ceník použit: ${result.added} přidáno, ${result.updated} upraveno, ${result.removed} odebráno.`,
        { variant: 'success' },
      );
      onClose();
    } catch (e) {
      enqueueSnackbar(apiErrorMessage(e, 'Ceník se nepodařilo použít.'), { variant: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const canSubmit = Boolean(file && effectiveFrom?.isValid());

  return (
    <FormDrawer
      open={open}
      title="Import ceníku"
      subtitle="Nahrajte ceník pivovaru v CSV, zkontrolujte změny a teprve pak je použijte."
      onClose={onClose}
      onSubmit={preview ? runApply : runPreview}
      busy={busy}
      submitDisabled={!canSubmit}
      submitLabel={preview ? 'Použít ceník' : 'Načíst náhled'}
      width={720}
    >
      <Stack direction="row" spacing={1.5} alignItems="flex-start">
        <Button
          component="label"
          variant="outlined"
          startIcon={<UploadFileIcon />}
          sx={{ height: 40, flexShrink: 0 }}
        >
          Vybrat soubor
          <input
            type="file"
            accept=".csv,text/csv"
            hidden
            aria-label="Soubor s ceníkem"
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              // A diff belongs to one file; keeping it after a swap would let the user apply
              // numbers they never saw.
              setPreview(null);
            }}
          />
        </Button>
        <DatePicker
          label="Platnost od"
          value={effectiveFrom}
          onChange={(v) => { setEffectiveFrom(v); setPreview(null); }}
          slotProps={{ textField: { fullWidth: true } }}
        />
      </Stack>

      <Typography variant="body2" color={file ? 'text.primary' : 'text.secondary'}>
        {file ? file.name : 'Zatím nevybrán žádný soubor.'}
      </Typography>

      {!preview && (
        <Alert severity="info">
          Náhled nic nezapisuje. Změny se uloží až tlačítkem „Použít ceník“.
        </Alert>
      )}

      {preview && (
        <>
          <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
            {BUCKETS.map((kind) => {
              const name = priceListChangeName(kind) ?? '';
              const count = bucketCount(preview, kind);
              return (
                <Chip
                  key={name}
                  size="small"
                  color={count > 0 ? BUCKET_COLOR[name] : 'default'}
                  variant={count > 0 ? 'filled' : 'outlined'}
                  label={`${priceListChangeLabel(kind)}: ${count}`}
                  sx={{ fontWeight: 700 }}
                />
              );
            })}
          </Stack>

          {toRemoveCount > 0 && (
            <Alert severity="warning">
              {toRemoveCount}{' '}
              {plural(toRemoveCount, 'produkt bude odebrán', 'produkty budou odebrány', 'produktů bude odebráno')}
              . Odebrání je vratné — produkt se skryje, historie objednávek zůstává.
            </Alert>
          )}

          {blockedCount > 0 && (
            <Alert severity="info">
              {blockedCount}{' '}
              {plural(blockedCount, 'produkt není v ceníku, ale zůstane', 'produkty nejsou v ceníku, ale zůstanou', 'produktů není v ceníku, ale zůstanou')}
              {' '}— jsou skladem nebo na otevřené objednávce.
            </Alert>
          )}

          {items.length === 0 ? (
            <Alert severity="success">Ceník odpovídá současnému stavu, není co měnit.</Alert>
          ) : (
            <TableContainer sx={{ overflowX: 'auto', border: 1, borderColor: 'divider', borderRadius: 2 }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Produkt</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Balení</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Změna</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>Cena</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {items.map((item, index) => {
                    const name = priceListChangeName(item.kind) ?? '';
                    return (
                      <TableRow key={`${item.name}-${index}`} hover>
                        <TableCell>
                          <Typography sx={{ fontWeight: 700 }}>{item.name}</Typography>
                          {changeSummary(item) && (
                            <Typography variant="caption" color="text.secondary">
                              {changeSummary(item)}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>
                          {packagingLabel(item.container, item.saleUnit, item.volumeLiters, item.unitsPerPackage)}
                        </TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            color={BUCKET_COLOR[name]}
                            label={priceListChangeLabel(item.kind)}
                            sx={{ height: 20, fontSize: 11, fontWeight: 700 }}
                          />
                        </TableCell>
                        <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                          {formatMoney(item.priceWithVat)}
                          {/* The lists round per-0,5 l and per-package independently, so a figure
                              the parser computed can differ from the printed one by a haléř. */}
                          {Boolean(item.derived) && (
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                              dopočteno
                            </Typography>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          <Box>
            <Typography variant="caption" color="text.secondary">
              Zdroj: {preview.sourceName ?? 'neuveden'} · pivovar {preview.breweryName}
            </Typography>
          </Box>
        </>
      )}
    </FormDrawer>
  );
}
