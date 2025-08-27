import React from "react";
import {CSS} from "@dnd-kit/utilities";
import {useSortable} from "@dnd-kit/sortable";

import {Box} from "@mui/material";

export function SortableView({id, children}: Readonly<{ id: string, children: React.ReactNode }>) {
    const {attributes, listeners, setNodeRef, transform, transition, isDragging} = useSortable({id});

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        cursor: 'grab',
        zIndex: isDragging ? 10 : 'auto',
    };

    return (
        <Box
            ref={setNodeRef}
            {...attributes}
            {...listeners}
            sx={{
                ...style,
                backgroundColor: 'background.paper',
                borderRadius: 2,
                border: '1px solid #ddd',
                boxShadow: isDragging ? 4 : 1,
                p: 2,
            }}
        >
            {children}
        </Box>
    );
}