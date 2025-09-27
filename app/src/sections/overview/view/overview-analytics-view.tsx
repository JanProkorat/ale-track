import {useTranslation} from "react-i18next";

import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';

import { DashboardContent } from 'src/layouts/dashboard';

import {RemindersOverview} from "../components/reminders-overview";

// ----------------------------------------------------------------------

export function OverviewAnalyticsView() {
    const {t} = useTranslation();

    return (
    <DashboardContent maxWidth="xl">
      <Typography variant="h4" sx={{ mb: { xs: 3, md: 5 } }}>
          {t('dashboard.welcome')} 👋
      </Typography>

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 6 }}>
          <RemindersOverview />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}/>
      </Grid>
    </DashboardContent>
  );
}
