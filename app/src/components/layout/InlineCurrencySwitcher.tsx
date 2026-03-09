import Box from '@mui/material/Box';
import Button from '@mui/material/Button';

import { useCurrency } from 'src/providers/CurrencyProvider';

import type { CurrencyCode } from 'src/providers/CurrencyProvider';

// ---------------------------------------------------------------------------
// Currency options
// ---------------------------------------------------------------------------

const currencies: { code: CurrencyCode; label: string }[] = [
     { code: 'CZK', label: 'CZK' },
     { code: 'EUR', label: 'EUR' },
];

// ---------------------------------------------------------------------------
// Inline currency switcher — shows currency buttons in a row
// ---------------------------------------------------------------------------

export default function InlineCurrencySwitcher() {
     const { currency, setCurrency } = useCurrency();

     return (
          <Box sx={{ display: 'flex', gap: 0.25 }}>
               {currencies.map((c) => {
                    const isActive = c.code === currency;
                    return (
                         <Button
                              key={c.code}
                              size="small"
                              variant={isActive ? 'contained' : 'text'}
                              onClick={() => setCurrency(c.code)}
                              sx={{
                                   minWidth: 36,
                                   px: 1,
                                   py: 0.25,
                                   fontSize: '0.7rem',
                                   fontWeight: isActive ? 700 : 400,
                                   opacity: isActive ? 1 : 0.5,
                                   '&:hover': { opacity: 1 },
                              }}
                         >
                              {c.label}
                         </Button>
                    );
               })}
          </Box>
     );
}
