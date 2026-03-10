import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Button from '@mui/material/Button';
import AddIcon from '@mui/icons-material/Add';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Autocomplete from '@mui/material/Autocomplete';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';

import { useUsers } from 'src/hooks/useUsers';

import { useUnsavedChanges } from 'src/providers/UnsavedChangesProvider';

import UserNameList from './components/UserNameList';
import UserInlineDetail from './components/UserInlineDetail';
import CreateUserDrawer from './components/CreateUserDrawer';

// ---------------------------------------------------------------------------

export default function UserListPage() {
     const { t } = useTranslation();
     const theme = useTheme();
     const isMobile = useMediaQuery(theme.breakpoints.down('md'));

     const [searchParams, setSearchParams] = useSearchParams();
     const selectedUserId = searchParams.get('id');

     const [search, setSearch] = useState('');
     const [sortAsc, setSortAsc] = useState(true);
     const [drawerOpen, setDrawerOpen] = useState(false);

     const { setDirty } = useUnsavedChanges();

     const { data: users = [], isLoading } = useUsers(search);

     const setSelectedUserId = useCallback(
          (id: string | null) => {
               setSearchParams((prev) => {
                    if (id) {
                         prev.set('id', id);
                    } else {
                         prev.delete('id');
                    }
                    return prev;
               }, { replace: true });
          },
          [setSearchParams],
     );

     // Auto-select first user (sorted by userName ascending) when nothing is selected
     useEffect(() => {
          if (!selectedUserId && !isLoading && users.length > 0) {
               const sorted = [...users].sort((a, b) =>
                    (a.userName ?? '').localeCompare(b.userName ?? '', undefined, { sensitivity: 'base' }),
               );
               setSelectedUserId(sorted[0].id ?? null);
          }
     }, [selectedUserId, isLoading, users, setSelectedUserId]);

     const handleCloseDetail = () => setSelectedUserId(null);

     const handleUserCreated = (userId: string) => {
          setDrawerOpen(false);
          setSelectedUserId(userId);
     };

     const detailContent = (
          <UserInlineDetail
               userId={selectedUserId}
               onDeleted={handleCloseDetail}
               onDirtyChange={setDirty}
          />
     );

     return (
          <Box>
               {/* Header */}
               <Box sx={{ mb: 3, display: 'flex', alignItems: 'center' }}>
                    <Typography variant="h4" sx={{ flexGrow: 1 }}>
                         {t('users.title')}
                    </Typography>
                    <Button
                         variant="contained"
                         color="inherit"
                         startIcon={<AddIcon />}
                         onClick={() => setDrawerOpen(true)}
                    >
                         {t('users.addUser')}
                    </Button>
               </Box>

               {/* Split view */}
               <Box
                    sx={{
                         display: 'flex',
                         flexDirection: { xs: 'column', md: 'row' },
                         alignItems: 'flex-start',
                         gap: 2,
                    }}
               >
                    {/* Left panel */}
                    {isMobile ? (
                         <Card sx={{ width: '100%', p: 2 }}>
                              <Autocomplete
                                   options={users}
                                   getOptionLabel={(option) => option.userName ?? ''}
                                   loading={isLoading}
                                   value={users.find((u) => u.id === selectedUserId) ?? null}
                                   onChange={(_e, newValue) =>
                                        setSelectedUserId(newValue?.id ?? null)
                                   }
                                   isOptionEqualToValue={(opt, val) => opt.id === val.id}
                                   renderInput={(params) => (
                                        <TextField
                                             {...params}
                                             size="small"
                                             placeholder={t('users.selectUser')}
                                        />
                                   )}
                              />
                         </Card>
                    ) : (
                         <Box sx={{ width: 280, flexShrink: 0 }}>
                              <UserNameList
                                   users={users}
                                   loading={isLoading}
                                   search={search}
                                   onSearchChange={setSearch}
                                   selectedId={selectedUserId}
                                   onSelect={setSelectedUserId}
                                   sortAsc={sortAsc}
                                   onToggleSort={() => setSortAsc((prev) => !prev)}
                              />
                         </Box>
                    )}

                    {/* Right panel — user detail */}
                    <Card
                         sx={{
                              flex: 1,
                              minWidth: 0,
                              width: { xs: '100%', md: 'auto' },
                              minHeight: { md: 400 },
                              p: 2,
                              display: 'flex',
                              flexDirection: 'column',
                              ...(!selectedUserId && {
                                   alignItems: 'center',
                                   justifyContent: 'center',
                              }),
                         }}
                    >
                         {detailContent}
                    </Card>
               </Box>

               {/* Create user drawer */}
               <CreateUserDrawer
                    open={drawerOpen}
                    onClose={() => setDrawerOpen(false)}
                    onCreated={handleUserCreated}
               />
          </Box>
     );
}
