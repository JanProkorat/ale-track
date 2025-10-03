import {useTranslation} from "react-i18next";
import React, {useState, useEffect, useCallback} from "react";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Drawer from "@mui/material/Drawer";
import Popover from "@mui/material/Popover";
import IconButton from "@mui/material/IconButton";
import NoteAltIcon from '@mui/icons-material/NoteAlt';
import ListItemButton from "@mui/material/ListItemButton";
import {List, Typography, ListItemIcon, ListItemText} from "@mui/material";

import {Iconify} from "../../../components/iconify";
import {Scrollbar} from "../../../components/scrollbar";
import {NoteDto, SectionType} from "../../../api/Client";
import NoteDetailView from "./components/note-detail-view";
import {AuthorizedClient} from "../../../api/AuthorizedClient";
import {useSnackbar} from "../../../providers/SnackbarProvider";
import {CollapsibleForm} from "../../../components/forms/collapsible-form";

type NotesViewProps = {
    parentId: string;
    parentType: SectionType;
}

export function NotesView({parentId, parentType}: Readonly<NotesViewProps>) {
    const {t} = useTranslation();
    const {showSnackbar} = useSnackbar();

    const [notes, setNotes] = useState<NoteDto[]>([]);
    const [selectedNote, setSelectedNote] = useState<NoteDto | null>(null);
    const [noteToUpdate, setNoteToUpdate] = useState<NoteDto | null>(null);
    const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
    const open = Boolean(anchorEl);

    const fetchClientNotes = useCallback(async () => {
        try {
            const client = new AuthorizedClient();
            return await client.getClientNotesEndpoint(parentId);
        } catch (error) {
            showSnackbar(t('notes.fetchError'), 'error');
            console.error('Error fetching notes:', error);
            return [];
        }
    }, [parentId, showSnackbar, t]);

    useEffect(() => {
        if (parentType === SectionType.Client)
            fetchClientNotes().then(setNotes)
    }, [fetchClientNotes, parentId, parentType])

    const closeDrawer = (shouldRefresh: boolean) => {
        if (shouldRefresh)
            fetchClientNotes().then(setNotes)

        setNoteToUpdate(null);
    }

    const handleDeleteNote = async (noteId: string) => {
        try {
            const client = new AuthorizedClient();
            await client.deleteClientNoteEndpoint(noteId).then(() => {
                setNotes((prevNotes) => prevNotes.filter((note) => note.id !== noteId));
                if (selectedNote?.id === noteId) {
                    setSelectedNote(null);
                }
                showSnackbar(t('notes.deleteSuccess'), 'success');
            });
        } catch (error) {
            showSnackbar(t('notes.deleteError'), 'error');
            console.error('Error deleting note:', error);
        }
    }

    const handleClose = () => {
        setAnchorEl(null);
        setSelectedNote(null);
    };

    const handleClick = (event: React.MouseEvent<HTMLElement>, note: NoteDto) => {
        setAnchorEl(event.currentTarget);
        setSelectedNote(note);
    };

    const newButton = (visible: boolean) => (
        <Box sx={{display: 'flex', alignItems: 'center'}}>
            <Button
                variant="contained"
                color="inherit"
                startIcon={<Iconify icon="mingcute:add-line"/>}
                size="small"
                sx={{
                    visibility: visible ? 'visible' : 'hidden',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                    mb: 1,
                    mt: 1,
                }}
                onClick={() => setNoteToUpdate(new NoteDto(
                    {
                        text: ""
                    }
                ))}
            >
                {t('notes.new')}
            </Button>
        </Box>
    );

    const noDataBox = (
        <Box sx={{py: 5, textAlign: 'center', width: '100%'}}>
            <Typography variant="h6" sx={{mb: 1}}>
                {t('notes.noDataTitle')}
            </Typography>

            <Typography variant="body2" whiteSpace="pre-line">
                {t('notes.noDataMessage')}
            </Typography>
            <Box sx={{mt: 2, display: 'flex', justifyContent: 'center'}}>
                {newButton(notes.length === 0)}
            </Box>
        </Box>
    );

    return (
        <CollapsibleForm title={t('notes.title')} titleVariant="subtitle1"
                         headerChildren={newButton(notes.length > 0)}>
            {notes.length === 0 ? noDataBox :
                <Scrollbar>
                    <List>
                        {notes.map((note, index) => (
                            <ListItemButton
                                key={note.id}
                                alignItems="flex-start"
                                divider={index !== notes.length - 1}
                                selected={selectedNote?.id === note.id}
                                sx={{pt: 0, pb: 0}}
                                onClick={(e) => handleClick(e, note)}
                            >
                                <ListItemIcon sx={{mt: 1}}>
                                    <NoteAltIcon color="inherit"/>
                                </ListItemIcon>
                                <ListItemText
                                    sx={{ml: 0, mt: 1, mb: 1, mr: 10}}
                                    primary={note.text}
                                    slotProps={{
                                        primary: {
                                            sx: {
                                                display: 'block',
                                                whiteSpace: 'nowrap',
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                            }
                                        }
                                    }}
                                />
                                <Box sx={{display: 'flex', alignItems: 'center'}}>
                                    <IconButton
                                        size="small"
                                        color="inherit"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setNoteToUpdate(new NoteDto({
                                                id: note.id,
                                                text: note.text ?? '',
                                            }))
                                        }}
                                        sx={{mt: 0.5}}
                                    >
                                        <Iconify icon="solar:pen-bold"/>
                                    </IconButton>
                                    <IconButton
                                        size="small"
                                        color="error"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleDeleteNote(note.id!)
                                        }}
                                        sx={{mt: 0.5}}
                                    >
                                        <Iconify icon="solar:trash-bin-trash-bold"/>
                                    </IconButton>
                                </Box>
                            </ListItemButton>
                        ))}
                    </List>
                </Scrollbar>}
            <Drawer
                anchor="right"
                open={noteToUpdate != null}
                onClose={closeDrawer}
            >
                <Box sx={{width: 700, p: 2}}>
                    <NoteDetailView noteToUpdate={noteToUpdate!} parentId={parentId} parentType={parentType} onClose={closeDrawer}/>
                </Box>
            </Drawer>
            <Popover
                open={open}
                anchorEl={anchorEl}
                onClose={handleClose}
                anchorOrigin={{vertical: 'top', horizontal: 'center'}}
                transformOrigin={{vertical: 'bottom', horizontal: 'center'}}
            >
                <Box sx={{minWidth: 300, p: 2}}>
                    {selectedNote && (
                        <Typography
                            component="span"
                            variant="body2"
                            sx={{
                                mt: 1,
                                ml: 1,
                                mr: 1,
                                color: 'text.primary',
                                display: 'block'
                            }}
                        >
                            {selectedNote.text}
                        </Typography>
                    )}
                </Box>
            </Popover>
        </CollapsibleForm>
    )
}