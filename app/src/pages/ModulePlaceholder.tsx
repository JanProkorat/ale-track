import { Card, CardContent, Typography, Box } from '@mui/material';
import ConstructionOutlinedIcon from '@mui/icons-material/ConstructionOutlined';
import { PageContainer, PageHeader } from 'src/components/common/PageHeader';

// Temporary landing for modules not yet built. Replaced per-module in P3–P12.
export function ModulePlaceholder({
  eyebrow,
  title,
  phase,
}: {
  eyebrow: string;
  title: string;
  phase: string;
}) {
  return (
    <PageContainer>
      <PageHeader eyebrow={eyebrow} title={title} subtitle="Modul se připravuje v rámci přestavby." />
      <Card>
        <CardContent sx={{ py: 6, textAlign: 'center' }}>
          <Box sx={{ color: 'text.disabled', mb: 1.5 }}>
            <ConstructionOutlinedIcon sx={{ fontSize: 40 }} />
          </Box>
          <Typography fontWeight={700} color="text.secondary">
            Bude doplněno ({phase})
          </Typography>
          <Typography variant="body2" color="text.disabled" sx={{ mt: 0.5 }}>
            Základ aplikace (téma, navigace, oprávnění, přihlášení) je hotový.
          </Typography>
        </CardContent>
      </Card>
    </PageContainer>
  );
}
