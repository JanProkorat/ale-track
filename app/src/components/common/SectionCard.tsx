import { useState } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Collapse from '@mui/material/Collapse';
import Typography from '@mui/material/Typography';
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
          <Card
               variant="outlined"
               sx={{
                    overflow: 'hidden',
                    borderColor: 'divider',
               }}
          >
               {/* Section header with subtle background */}
               <Stack
                    direction="row"
                    alignItems="center"
                    sx={{
                         px: 2,
                         py: 1.5,
                         bgcolor: 'background.neutral',
                         borderBottom: expanded ? '1px solid' : 'none',
                         borderColor: 'divider',
                    }}
               >
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

               {/* Collapsible content */}
               <Collapse in={expanded}>
                    <Box sx={{ p: 2 }}>
                         {children}
                    </Box>
               </Collapse>
          </Card>
     );
}
