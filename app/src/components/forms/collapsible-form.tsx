import { useState, type ReactNode } from "react";

import Box from "@mui/material/Box";
import { Collapse } from "@mui/material";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";

import { SectionHeader } from "../label/section-header";

type CollapsibleFormProps = {
    title: string;
    titleVariant?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'subtitle1' | 'subtitle2' | 'body1' | 'body2' | 'caption' | 'button' | 'overline';
    headerChildren?: ReactNode;
    children: ReactNode;
}

export function CollapsibleForm({ title, titleVariant, headerChildren, children }: Readonly<CollapsibleFormProps>) {
    const [isExpanded, setIsExpanded] = useState<boolean>(true);

    return (
        <>
            <SectionHeader
                text={title}
                headerVariant={titleVariant}
                sx={{
                    mt: 2,
                    cursor: 'pointer'
                }}
                onClick={() => setIsExpanded(prev => !prev)}
            >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {isExpanded ? headerChildren : undefined}
                    {isExpanded ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
                </Box>
            </SectionHeader>
            <Collapse in={isExpanded} sx={{ mb: 0.5 }}>
                {children}
            </Collapse>
        </>
    )
}