import React, {useState} from "react";
import {useTranslation} from "react-i18next";

import Box from "@mui/material/Box";
import {FormControl} from "@mui/material";
import TextField from "@mui/material/TextField";

import {AuthorizedClient} from "../../../../api/AuthorizedClient";
import {useSnackbar} from "../../../../providers/SnackbarProvider";
import {DrawerLayout} from "../../../../layouts/components/drawer-layout";
import {useEntityStatsRefresh} from "../../../../providers/EntityStatsContext";
import {SectionType, CreateNoteDto, UpdateNoteDto} from "../../../../api/Client";

import type { NoteDto} from "../../../../api/Client";

type NoteDetailViewProps = {
    noteToUpdate: NoteDto;
    parentId: string,
    parentType: SectionType,
    onClose: (shouldRefresh: boolean) => void
};

function NoteDetailView({noteToUpdate, parentId, parentType, onClose}: Readonly<NoteDetailViewProps>) {
    const {showSnackbar} = useSnackbar();
    const {t} = useTranslation();
    const {triggerRefresh} = useEntityStatsRefresh();

    const [text, setText] = useState<string>(noteToUpdate?.text ?? '');

    const [errors, setErrors] = useState<Record<string, string>>({});

    const validateNote = (noteText: string): Record<string, string> => {
        const validationErrors: Record<string, string> = {};
        
        if (!noteText || noteText.trim().length === 0) {
            validationErrors.content = t('common.required');
        } else if (noteText.length > 1000) {
            validationErrors.content = t('common.maxLength', { count: 1000 });
        }

        return validationErrors;
    };

    const saveNote = async (): Promise<void> => {
        setErrors({});
        const newErrors = validateNote(text);

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            showSnackbar(t('common.validationError'), 'error');
            return;
        }

        try {
            const clientApi = new AuthorizedClient();


            switch (parentType) {
                case SectionType.Client:
                    if (noteToUpdate.id === null || noteToUpdate.id === undefined) {
                        await clientApi.createClientNoteEndpoint(parentId, new CreateNoteDto({text}));
                    } else {
                        await clientApi.updateClientNoteEndpoint(noteToUpdate.id, new UpdateNoteDto({text}));
                    }
                    break;
                case SectionType.Brewery:
                default:
                    break;
            }

            triggerRefresh();
            showSnackbar(t('notes.saveSuccess'), 'success');
            onClose(true);
        } catch (error) {
            console.error('Error saving text:', error);
            showSnackbar(t('notes.saveError'), 'error');
            return;
        }
    };

    const handleContentChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setText(event.target.value);
    };

    return (
        <DrawerLayout
            title={t('notes.detailTitle')}
            isLoading={false}
            onClose={() => onClose(false)}
            onSaveAndClose={saveNote}
        >
            <Box sx={{mt: 1}}>
                <FormControl fullWidth>
                    <TextField
                        id="create-note-content"
                        label="Text"
                        multiline
                        minRows={8}
                        maxRows={15}
                        value={text}
                        onChange={handleContentChange}
                        error={!!errors.content}
                        helperText={errors.content || `${text.length}/1000`}
                        slotProps={{
                            input: {
                                inputProps: {maxLength: 1000}
                            }
                        }}
                    />
                </FormControl>
            </Box>
        </DrawerLayout>
    );
}

export default NoteDetailView;
