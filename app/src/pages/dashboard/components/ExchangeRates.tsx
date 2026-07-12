import { useTranslation } from 'react-i18next';

import Table from '@mui/material/Table';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import Typography from '@mui/material/Typography';

import { useExchangeRates } from 'src/hooks/useExchangeRates';

import { currencySymbol } from 'src/providers/CurrencyProvider';

import EmptyState from 'src/components/common/EmptyState';
import SectionCard from 'src/components/common/SectionCard';
import LoadingSpinner from 'src/components/common/LoadingSpinner';

export default function ExchangeRates() {
     const { t } = useTranslation();
     const { data: rates = [], isLoading } = useExchangeRates();

     return (
          <SectionCard title={t('dashboard.exchangeRates')}>
               {isLoading ? (
                    <LoadingSpinner />
               ) : rates.length === 0 ? (
                    <EmptyState />
               ) : (
                    <Table size="small">
                         <TableBody>
                              {rates.map((rate) => (
                                   <TableRow key={rate.currencyCode}>
                                        <TableCell sx={{ fontWeight: 600, border: 0, pl: 0 }}>
                                             1 {currencySymbol(rate.currencyCode ?? '')}
                                        </TableCell>
                                        <TableCell align="right" sx={{ border: 0, pr: 0 }}>
                                             {rate.rate?.toFixed(3)}
                                             <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 0.5 }}>
                                                  Kč
                                             </Typography>
                                        </TableCell>
                                   </TableRow>
                              ))}
                         </TableBody>
                    </Table>
               )}
          </SectionCard>
     );
}
