import { useTranslation } from 'react-i18next';

import Typography from '@mui/material/Typography';

export default function DashboardPage() {
     const { t } = useTranslation();

     return <Typography variant="h5">{t('dashboard.title')}</Typography>;
}
