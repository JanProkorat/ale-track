import Chip from '@mui/material/Chip';

// ---------------------------------------------------------------------------
// StatusChip
// ---------------------------------------------------------------------------

interface StatusChipProps {
     label: string;
     color?: 'success' | 'warning' | 'error' | 'info' | 'default' | 'primary';
}

export default function StatusChip({ label, color = 'default' }: StatusChipProps) {
     return <Chip label={label} size="small" variant="outlined" color={color} />;
}
