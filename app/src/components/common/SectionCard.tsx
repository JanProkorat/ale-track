import { useState } from 'react';

import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Collapse from '@mui/material/Collapse';
import Typography from '@mui/material/Typography';
import CardContent from '@mui/material/CardContent';
import IconButton from '@mui/material/IconButton';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

interface SectionCardProps {
     title: string;
     action?: React.ReactNode;
     defaultExpanded?: boolean;
     children: React.ReactNode;
}

export default function SectionCard({ title, action, defaultExpanded = true, children }: SectionCardProps) {
     const [expanded, setExpanded] = useState(defaultExpanded);

     return (
          <Card variant="outlined">
               <CardContent sx={{ '&:last-child': { pb: expanded ? undefined : 2 } }}>
                    <Stack direction="row" alignItems="center" sx={{ mb: expanded ? 2 : 0 }}>
                         <IconButton
                              size="small"
                              onClick={() => setExpanded((prev) => !prev)}
                              sx={{
                                   mr: 1,
                                   transform: expanded ? 'rotate(0deg)' : 'rotate(-90deg)',
                                   transition: 'transform 0.2s',
                              }}
                         >
                              <ExpandMoreIcon fontSize="small" />
                         </IconButton>
                         <Typography
                              variant="subtitle1"
                              sx={{ flex: 1, fontWeight: 600, cursor: 'pointer', userSelect: 'none' }}
                              onClick={() => setExpanded((prev) => !prev)}
                         >
                              {title}
                         </Typography>
                         {action}
                    </Stack>
                    <Collapse in={expanded}>
                         {children}
                    </Collapse>
               </CardContent>
          </Card>
     );
}
