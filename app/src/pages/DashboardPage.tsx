import { useTranslation } from 'react-i18next';

import Box from '@mui/material/Box';

import PageHeader from 'src/components/common/PageHeader';
import StatCards from 'src/pages/dashboard/components/StatCards';
import UpcomingReminders from 'src/pages/dashboard/components/UpcomingReminders';
import OrderItemReminders from 'src/pages/dashboard/components/OrderItemReminders';
import DriverAvailabilityCalendar from 'src/pages/dashboard/components/DriverAvailabilityCalendar';
import ActiveShipments from 'src/pages/dashboard/components/ActiveShipments';
import ActiveDeliveries from 'src/pages/dashboard/components/ActiveDeliveries';
import ExchangeRates from 'src/pages/dashboard/components/ExchangeRates';

export default function DashboardPage() {
     const { t } = useTranslation();

     return (
          <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1400, mx: 'auto' }}>
               <PageHeader title={t('dashboard.title')} />

               <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {/* Stats row */}
                    <StatCards />

                    {/* Reminders row */}
                    <Box
                         sx={{
                              display: 'grid',
                              gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
                              gap: 3,
                         }}
                    >
                         <UpcomingReminders />
                         <OrderItemReminders />
                    </Box>

                    {/* Driver availability */}
                    <DriverAvailabilityCalendar />

                    {/* Active shipments & deliveries */}
                    <Box
                         sx={{
                              display: 'grid',
                              gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
                              gap: 3,
                         }}
                    >
                         <ActiveShipments />
                         <ActiveDeliveries />
                    </Box>

                    {/* Exchange rates */}
                    <ExchangeRates />
               </Box>
          </Box>
     );
}
