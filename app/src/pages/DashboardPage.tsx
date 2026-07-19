import { Grid, Card, CardContent, Typography, Box } from '@mui/material';
import { PageContainer, PageHeader } from 'src/components/common/PageHeader';
import { NAV_GROUPS } from 'src/layout/nav-config';
import { useAuth } from 'src/auth/AuthProvider';
import { Link as RouterLink } from 'react-router-dom';

export function DashboardPage() {
  const { user, canSee } = useAuth();
  const tiles = NAV_GROUPS.flatMap((g) => g.items).filter((it) => it.key !== 'dashboard' && canSee(it.key));

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Přehled"
        title="Nástěnka"
        subtitle={`Vítejte zpět, ${user?.firstName ?? ''}. Skutečná data se připojí v P2.`}
      />
      <Grid container spacing={2}>
        {tiles.map((it) => (
          <Grid key={it.key} size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
            <Card
              component={RouterLink}
              to={it.path}
              sx={{ display: 'block', textDecoration: 'none', transition: '.15s', '&:hover': { boxShadow: 3, transform: 'translateY(-2px)' } }}
            >
              <CardContent>
                <Box sx={{ color: 'primary.main', mb: 1 }}>{it.icon}</Box>
                <Typography variant="h6">{it.label}</Typography>
                <Typography variant="body2" color="text.secondary">
                  Otevřít modul
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </PageContainer>
  );
}
