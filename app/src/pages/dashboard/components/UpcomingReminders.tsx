import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import Box from '@mui/material/Box';
import List from '@mui/material/List';
import Typography from '@mui/material/Typography';
import ListItemText from '@mui/material/ListItemText';
import ListItemButton from '@mui/material/ListItemButton';

import { useUpcomingReminders } from 'src/hooks/useUpcomingReminders';

import { SectionType } from 'src/generated/api-client';

import EmptyState from 'src/components/common/EmptyState';
import SectionCard from 'src/components/common/SectionCard';
import LoadingSpinner from 'src/components/common/LoadingSpinner';

function formatDate(date: Date | undefined): string {
     if (!date) return '';
     return new Date(date).toLocaleDateString();
}

function getSectionPath(type: SectionType | string | undefined, id: string | undefined): string {
     if (!id) return '#';
     const t = typeof type === 'string' ? type : SectionType[type as SectionType];
     switch (t) {
          case 'Brewery':
               return `/breweries?id=${id}`;
          case 'Client':
               return `/clients?id=${id}`;
          default:
               return '#';
     }
}

export default function UpcomingReminders() {
     const { t } = useTranslation();
     const { data = [], isLoading } = useUpcomingReminders();
     const navigate = useNavigate();

     return (
          <SectionCard title={t('dashboard.upcomingReminders')}>
               {isLoading ? (
                    <LoadingSpinner />
               ) : data.length === 0 ? (
                    <EmptyState />
               ) : (
                    <Box>
                         {data.map((section) => (
                              <Box key={`${section.sectionType}-${section.sectionId}`} sx={{ mb: 2, '&:last-child': { mb: 0 } }}>
                                   <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                                        <Typography variant="subtitle2" fontWeight={600}>
                                             {section.sectionName}
                                        </Typography>
                                   </Box>
                                   <List dense disablePadding>
                                        {section.reminders?.map((reminder) => (
                                             <ListItemButton
                                                  key={reminder.id}
                                                  onClick={() => navigate(getSectionPath(section.sectionType, section.sectionId))}
                                                  sx={{ borderRadius: 1, py: 0.5 }}
                                             >
                                                  <ListItemText
                                                       primary={reminder.name}
                                                       secondary={reminder.description}
                                                  />
                                                  <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap', ml: 1 }}>
                                                       {formatDate(reminder.occurrenceDate)}
                                                  </Typography>
                                             </ListItemButton>
                                        ))}
                                   </List>
                              </Box>
                         ))}
                    </Box>
               )}
          </SectionCard>
     );
}
