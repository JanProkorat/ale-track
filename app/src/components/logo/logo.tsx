import type {LinkProps} from '@mui/material/Link';

import React from 'react';
import mergeClasses from 'classnames';
import {Link as RouterLink} from 'react-router-dom';

import {styled} from '@mui/system';
import Link from '@mui/material/Link';
import {useTheme} from '@mui/material/styles';

import {logoClasses} from "./classes";
import fullLogo from './logo-full.png';
import smallLogo from './logo-small.png';

export type LogoProps = LinkProps & {
    isSingle?: boolean;
    disabled?: boolean;
};

export function Logo({
                         sx,
                         disabled,
                         className,
                         href = '/',
                         isSingle = false,
                         ...other
                     }: LogoProps) {
    const logoSrc = isSingle ? smallLogo : fullLogo;

    return (
        <LogoRoot
            component={RouterLink}
            href={href}
            aria-label="Logo"
            underline="none"
            className={mergeClasses([logoClasses.root, className])}
            sx={[
                {
                    width: isSingle ? 40 : 120,
                    height: isSingle ? 40 : 36,
                    ...(disabled && { pointerEvents: 'none' }),
                },
                ...(Array.isArray(sx) ? sx : [sx]),
            ]}
            {...other}
        >
            <img
                src={logoSrc}
                alt={isSingle ? "Single Logo" : "Full Logo"}
                style={{ width: '100%', height: '100%' }}
            />
        </LogoRoot>
    );
}

// ----------------------------------------------------------------------

const LogoRoot = styled(Link)(() => ({
    flexShrink: 0,
    color: 'transparent',
    display: 'inline-flex',
    verticalAlign: 'middle',
}));