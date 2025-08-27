import type { Breakpoint } from '@mui/material/styles';
import type { ContainerProps } from '@mui/material/Container';

import { mergeClasses } from 'minimal-shared/utils';

import Container from '@mui/material/Container';

import { layoutClasses } from '../core';

// ----------------------------------------------------------------------

export type DashboardContentProps = ContainerProps & {
  layoutQuery?: Breakpoint;
  disablePadding?: boolean;
};

export function DashboardContent({
  sx,
  children,
  className,
  disablePadding,
  maxWidth = 'xl',
  layoutQuery = 'xl',
  ...other
}: DashboardContentProps) {
  return (
    <Container
        id="test-dashboard"
      className={mergeClasses([layoutClasses.content, className])}
      maxWidth={false}
      sx={[
        (theme) => ({
          display: 'flex',
          flex: '1 1 auto',
          flexDirection: 'column',
          pt: 'var(--layout-dashboard-content-pt)',
          pb: 'var(--layout-dashboard-content-pb)',
          [theme.breakpoints.up(layoutQuery)]: {
            px: 'var(--layout-dashboard-content-px)',
          },
          ...(disablePadding && {
            p: {
              xs: 0,
              sm: 0,
              md: 0,
              lg: 0,
              xl: 0,
            },
          }),
          maxWidth: '2560px',
          margin: '0 auto',
        }),
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
      {...other}
    >
      {children}
    </Container>
  );
}
