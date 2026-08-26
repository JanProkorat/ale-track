// Choosing what an export carries.
//
// The file's body is the confirmed rows of the invoice split, and a run gets
// confirmed over a morning — so every download used to repeat the rows that had
// already gone out with the last one. This drawer is where the office picks, and
// it reads the export stamps the backend writes so it can preselect what is new.
//
// Rows come off the same `useShipmentInvoices` query the Fakturace card uses, so
// opening the drawer costs nothing when that card is already on screen, and the
// two can never disagree about a row's number or readiness.

import { useEffect, useMemo, useState } from 'react';
import {
  Box, Button, Checkbox, CircularProgress, Divider, Drawer, IconButton, Stack, Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/CloseOutlined';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import TableChartOutlinedIcon from '@mui/icons-material/TableChartOutlined';
import { SegControl } from 'src/components/common/SegControl';
import { useShipmentInvoices } from 'src/hooks/useShipmentInvoices';
import { fmtDateShort, fmtTime, num, plural } from 'src/lib/format';
import { exportScopeHint, L } from 'src/lib/labels';
import { useCurrency } from 'src/providers/CurrencyProvider';
import { colorForClient } from './clientColor';
import { toBands, type ClientBand } from './shipmentInvoiceModel';
import type { ShipmentExportFormat, ShipmentExportScopeName } from 'src/hooks/useShipments';

/** "23. 8. 21:40" — the date alone cannot tell two exports of one morning apart. */
function fmtStamp(d: Date): string {
  return `${fmtDateShort(d)} ${fmtTime(new Date(d))}`;
}

/** One choosable row: a confirmed client, its number, and when it last went out. */
function ExportRow({ band, checked, onToggle }: {
  band: ClientBand;
  checked: boolean;
  onToggle: () => void;
}) {
  const { formatMoney } = useCurrency();
  const exported = band.lastExportedAt;

  return (
    <Stack
      direction="row"
      spacing={1.25}
      alignItems="center"
      onClick={onToggle}
      data-testid={`export-row-${band.clientId}`}
      sx={{
        px: 1.25, py: 1, borderRadius: 2, border: 1, cursor: 'pointer',
        // The app's selected-row idiom — amber border over the amber tint, as the order
        // editor's product rows use (`ProductRow` in OrderEditor.tsx). It marks what is
        // ticked, never what has already been exported: that is what the line under the
        // client's name says, and one colour cannot mean two things on one row.
        borderColor: checked ? 'warning.main' : 'divider',
        bgcolor: (t) => (checked ? t.vars!.palette.brand.amberTint : 'transparent'),
      }}
    >
      <Checkbox
        size="small"
        checked={checked}
        onChange={onToggle}
        onClick={(e) => e.stopPropagation()}
        inputProps={{ 'aria-label': band.clientName }}
        sx={{ p: 0.5 }}
      />
      <Box
        sx={{
          width: 24, height: 24, borderRadius: '50%', flex: '0 0 auto',
          bgcolor: colorForClient(band.clientId), color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11.5, fontWeight: 700,
        }}
      >
        {band.number ?? '–'}
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        {/* Trading name on the same line rather than a third one: the row is two lines by design,
            and the export stamp needs the second. */}
        <Typography sx={{ fontSize: 13.5, fontWeight: 700 }} noWrap>
          {band.clientName}
          {band.clientBusinessName && (
            <Typography component="span" sx={{ fontSize: 12, fontWeight: 500, color: 'text.secondary' }}>
              {` · ${band.clientBusinessName}`}
            </Typography>
          )}
        </Typography>
        <Typography sx={{ fontSize: 11.5, color: exported ? 'warning.dark' : 'text.secondary' }}>
          {exported ? `Exportováno ${fmtStamp(exported)}` : 'Zatím neexportováno'}
          {/* Named on the row rather than only in the scope's hint: choosing "jen změny" is a
              choice about these rows, and the office should see which of them it will land on. */}
          {band.deviationCount > 0 && (
            <Typography component="span" sx={{ fontSize: 11.5, color: 'text.secondary' }}>
              {` · ${num(band.deviationCount)} ${plural(band.deviationCount, 'odchylka', 'odchylky', 'odchylek')}`}
            </Typography>
          )}
        </Typography>
      </Box>
      <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
        <Typography sx={{ fontSize: 12.5, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
          {num(band.quantity)} ks
        </Typography>
        <Typography sx={{ fontSize: 11.5, color: 'text.secondary' }}>
          {formatMoney(band.value)}
        </Typography>
      </Box>
    </Stack>
  );
}

export function ExportSelectionDrawer({ open, shipmentId, busy, onClose, onExport }: {
  open: boolean;
  shipmentId: string;
  /** An export is running — both formats are locked so a second click cannot race the first. */
  busy: boolean;
  onClose: () => void;
  onExport: (format: ShipmentExportFormat, clientIds: string[], scope: ShipmentExportScopeName) => void;
}) {
  const { data, isLoading, isError } = useShipmentInvoices(open ? shipmentId : undefined);

  // Only confirmed rows can be exported — an unconfirmed one has nothing in the file. They arrive
  // in confirmation-number order, which is the order the file itself uses.
  const rows = useMemo(
    () => (data ? toBands(data).filter((band) => band.isReady) : []),
    [data],
  );

  // Null until the drawer has something to seed from, so a refetch — the query refetches on window
  // focus — cannot wipe a selection the office is halfway through making.
  const [selected, setSelected] = useState<Set<string> | null>(null);

  // The plan, which is what an export meant before there was a choice — so the office's muscle
  // memory keeps producing the file it already knows.
  const [scope, setScope] = useState<ShipmentExportScopeName>('plan');

  // Deviations only start being recorded once the invoicing is filed, so before that all three
  // scopes would produce the same file and the choice is noise.
  const filed = data?.isInvoicingFiled ?? false;
  const offersScope = filed && rows.length > 0;

  useEffect(() => {
    if (!open) {
      setSelected(null);
      setScope('plan');
      return;
    }

    setSelected((current) => {
      if (current !== null || rows.length === 0) return current;
      return new Set(rows.filter((band) => !band.lastExportedAt).map((band) => band.clientId));
    });
  }, [open, rows]);

  const ticked = selected ?? new Set<string>();

  const toggle = (clientId: string) => setSelected(() => {
    const next = new Set(ticked);
    if (next.has(clientId)) next.delete(clientId);
    else next.add(clientId);
    return next;
  });

  const allTicked = rows.length > 0 && rows.every((band) => ticked.has(band.clientId));

  // Counted over the chosen rows rather than the run: "jen změny" of two rows that went to plan is
  // an empty file even on a run where something else changed, and an empty file cannot be told
  // from a broken one.
  const chosenDeviations = rows
    .filter((band) => ticked.has(band.clientId))
    .reduce((total, band) => total + band.deviationCount, 0);

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={busy ? undefined : onClose}
      slotProps={{
        paper: {
          sx: {
            width: { xs: '100%', sm: 460 }, maxWidth: '100%',
            bgcolor: 'background.default', backgroundImage: 'none',
          },
        },
      }}
    >
      <Stack direction="row" alignItems="flex-start" spacing={1} sx={{ px: 3, py: 2.25 }}>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography variant="h6" sx={{ fontSize: 18 }}>Export vývozu</Typography>
          <Typography variant="body2" color="text.secondary">
            Vyberte objednávky, které mají být ve souboru
          </Typography>
        </Box>
        <IconButton onClick={onClose} disabled={busy} aria-label="Zavřít">
          <CloseIcon />
        </IconButton>
      </Stack>
      <Divider />

      <Box sx={{ flex: 1, overflowY: 'auto', px: 3, py: 2.5 }}>
        {isLoading && (
          <Stack alignItems="center" sx={{ py: 4 }}><CircularProgress size={22} /></Stack>
        )}

        {isError && (
          <Typography sx={{ fontSize: 13, color: 'error.main' }}>
            Rozdělení na faktury se nepodařilo načíst.
          </Typography>
        )}

        {!isLoading && !isError && rows.length === 0 && (
          <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>
            Žádná objednávka není označená jako hotová — do souboru nemá co jít.
          </Typography>
        )}

        {offersScope && (
          <Stack spacing={0.75} sx={{ mb: 2.5 }}>
            <Typography sx={{ fontSize: 12.5, fontWeight: 700 }}>Co má soubor obsahovat</Typography>
            <SegControl
              value={scope}
              onChange={setScope}
              options={(['plan', 'changed', 'all'] as const).map((value) => ({
                value,
                label: L.exportScope[value],
              }))}
            />
            <Typography sx={{ fontSize: 11.5, color: 'text.secondary' }}>
              {exportScopeHint[scope]}
            </Typography>
            {scope === 'changed' && chosenDeviations === 0 && (
              <Typography sx={{ fontSize: 11.5, color: 'warning.dark' }}>
                U vybraných objednávek není zaznamenaná žádná odchylka — soubor bude prázdný.
              </Typography>
            )}
          </Stack>
        )}

        {rows.length > 0 && (
          <Stack spacing={1}>
            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Typography sx={{ fontSize: 12.5, color: 'text.secondary' }}>
                {ticked.size} z {rows.length} {plural(rows.length, 'objednávky', 'objednávek', 'objednávek')}
              </Typography>
              <Button
                size="small"
                variant="text"
                onClick={() => setSelected(allTicked
                  ? new Set<string>()
                  : new Set(rows.map((band) => band.clientId)))}
              >
                {allTicked ? 'Odznačit vše' : 'Označit vše'}
              </Button>
            </Stack>

            {rows.map((band) => (
              <ExportRow
                key={band.clientId}
                band={band}
                checked={ticked.has(band.clientId)}
                onToggle={() => toggle(band.clientId)}
              />
            ))}
          </Stack>
        )}
      </Box>

      <Divider />
      {/* Both formats sit here rather than in a menu before the drawer: the format is part of
          confirming the export, not a separate decision taken before choosing the rows. */}
      <Stack direction="row" spacing={1.5} justifyContent="flex-end" sx={{ px: 3, py: 2 }}>
        <Button
          startIcon={<TableChartOutlinedIcon />}
          variant="outlined"
          disabled={busy || ticked.size === 0}
          onClick={() => onExport('excel', [...ticked], scope)}
        >
          Excel
        </Button>
        <Button
          startIcon={<DescriptionOutlinedIcon />}
          variant="contained"
          disabled={busy || ticked.size === 0}
          onClick={() => onExport('word', [...ticked], scope)}
        >
          Word
        </Button>
      </Stack>
    </Drawer>
  );
}
