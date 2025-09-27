import type {ReactNode} from "react";
import type {Theme, SxProps} from "@mui/material/styles";

import React from "react";

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";


type SectionHeaderProps = {
    text: string;
    headerVariant?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'subtitle1' | 'subtitle2' | 'body1' | 'body2' | 'caption' | 'button' | 'overline';
    children?: ReactNode;
    sx?: SxProps<Theme>;
    onClick?: () => void;
    bold?: boolean;
    bottomLineVisible?: boolean;
}

export function SectionHeader({text, headerVariant, children, sx, onClick, bold, bottomLineVisible}: Readonly<SectionHeaderProps>) {
    return (
        <Box
            sx={[
                {
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderBottom: bottomLineVisible == null || bottomLineVisible ? '1px solid #eee' : undefined
                },
                ...(Array.isArray(sx) ? sx : [sx])
            ]}
        >
            <Typography
                variant={headerVariant ?? "subtitle1"}
                sx={{
                    fontWeight: bold === undefined || bold ? 'bold' : undefined,
                    width: '80%'
                }}
                onClick={() => onClick && onClick()}
            >
                {text}
            </Typography>
            {children}
        </Box>
    );
}