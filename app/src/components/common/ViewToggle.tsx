import { ToggleButton, ToggleButtonGroup } from '@mui/material';
import ViewListIcon from '@mui/icons-material/ViewListOutlined';
import GridViewIcon from '@mui/icons-material/GridViewOutlined';

export type ViewMode = 'list' | 'grid';

/** List/grid segmented switch (Sklad and any card-vs-table view). */
export function ViewToggle({ value, onChange }: { value: ViewMode; onChange: (v: ViewMode) => void }) {
  return (
    <ToggleButtonGroup
      size="small"
      exclusive
      value={value}
      onChange={(_e, v: ViewMode | null) => v && onChange(v)}
    >
      <ToggleButton value="list" aria-label="Seznam">
        <ViewListIcon fontSize="small" />
      </ToggleButton>
      <ToggleButton value="grid" aria-label="Mřížka">
        <GridViewIcon fontSize="small" />
      </ToggleButton>
    </ToggleButtonGroup>
  );
}
