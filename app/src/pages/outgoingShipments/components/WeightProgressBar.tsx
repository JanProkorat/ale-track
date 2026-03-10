import { useTranslation } from 'react-i18next';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import LinearProgress from '@mui/material/LinearProgress';

interface WeightProgressBarProps {
     currentWeight: number;
     maxWeight: number;
}

export default function WeightProgressBar({ currentWeight, maxWeight }: WeightProgressBarProps) {
     const { t } = useTranslation();

     if (maxWeight <= 0) return null;

     const percentage = Math.min((currentWeight / maxWeight) * 100, 100);
     const isOver = currentWeight > maxWeight;
     const isWarning = percentage >= 80 && !isOver;

     const color = isOver ? 'error' : isWarning ? 'warning' : 'success';

     return (
          <Box sx={{ mb: 2 }}>
               <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', mb: 0.5 }}>
                    <Typography variant="caption" color="text.secondary">
                         {t('vehicles.maxWeight')}
                    </Typography>
                    <Typography
                         variant="body2"
                         fontWeight={600}
                         color={isOver ? 'error.main' : 'text.primary'}
                    >
                         {currentWeight.toFixed(1)} / {maxWeight} kg
                    </Typography>
               </Box>
               <LinearProgress
                    variant="determinate"
                    value={percentage}
                    color={color}
                    sx={{ height: 8, borderRadius: 1 }}
               />
          </Box>
     );
}
