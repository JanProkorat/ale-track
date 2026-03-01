import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';

export function useIsMobile(): boolean {
     return useMediaQuery(useTheme().breakpoints.down('md'));
}
