import type { Breakpoint } from '@mui/material/styles';

import { merge } from 'es-toolkit';
import { useBoolean } from 'minimal-shared/hooks';
import { useState, useEffect, useCallback } from "react";

import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import { useTheme } from '@mui/material/styles';

import { NavMobile, NavDesktop } from './nav';
import { dashboardLayoutVars } from './css-vars';
import { useAuth } from "../../context/AuthContext";
import { getNavData } from "../nav-config-dashboard";
import { useApiCall } from "../../hooks/use-api-call";
import { MenuButton } from '../components/menu-button';
import { AuthorizedClient } from "../../api/AuthorizedClient";
import { AccountPopover } from '../components/account-popover';
import { useEntityStatsRefresh } from "../../providers/EntityStatsContext";
import { MainSection, HeaderSection, LayoutSection, layoutClasses } from '../core';

import type { NumberOfRecordsInEachModuleDto } from "../../api/Client";
import type { MainSectionProps, HeaderSectionProps, LayoutSectionProps } from '../core';

// ----------------------------------------------------------------------

export const languages = [
  {
    value: 'en',
    label: 'English',
    icon: '/assets/icons/flags/ic-flag-en.svg',
  },
  {
    value: 'de',
    label: 'German',
    icon: '/assets/icons/flags/ic-flag-de.svg',
  },
  {
    value: 'cs',
    label: 'Czech',
    icon: '/assets/icons/flags/ic-flag-cs.svg',
  },
];

export const currencies = [
  {
    code: 'CZK',
    icon: '/assets/icons/flags/ic-flag-cs.svg',
  },
  {
    code: 'EUR',
    icon: '/assets/icons/flags/ic-flag-eu.svg',
  },
];

// ----------------------------------------------------------------------

type LayoutBaseProps = Pick<LayoutSectionProps, 'sx' | 'children' | 'cssVars'>;

export type DashboardLayoutProps = LayoutBaseProps & {
  layoutQuery?: Breakpoint;
  slotProps?: {
    header?: HeaderSectionProps;
    main?: MainSectionProps;
  };
};

export function DashboardLayout({
  sx,
  cssVars,
  children,
  slotProps,
  layoutQuery = 'lg',
}: DashboardLayoutProps) {
  const theme = useTheme();
  const { refreshKey } = useEntityStatsRefresh();
  const { user } = useAuth();
  const { executeApiCall } = useApiCall();

  const [navCounts, setNavCounts] = useState<NumberOfRecordsInEachModuleDto | undefined>(undefined);

  const fetchInventoryCount = useCallback(async () => {
    const client = new AuthorizedClient();
    const data = await executeApiCall(() => client.getNumberOfRecordsInEachModuleEndpoint());

    if (data) {
      setNavCounts(data);
    }
  }, [executeApiCall]);

  useEffect(() => {
    fetchInventoryCount();
  }, [refreshKey, fetchInventoryCount]);

  const { value: open, onFalse: onClose, onTrue: onOpen } = useBoolean();

  const renderHeader = () => {
    const headerSlotProps: HeaderSectionProps['slotProps'] = {
      container: {
        maxWidth: false,
      },
    };

    const navData = getNavData({ numberOfRecordsInEachModule: navCounts, userRole: user?.role });

    const headerSlots: HeaderSectionProps['slots'] = {
      topArea: (
        <Alert severity="info" sx={{ display: 'none', borderRadius: 0 }}>
          This is an info Alert.
        </Alert>
      ),
      leftArea: (
        <>
          {/** @slot Nav mobile */}
          <MenuButton
            onClick={onOpen}
            sx={{ mr: 1, ml: -1, [theme.breakpoints.up(layoutQuery)]: { display: 'none' } }}
          />
          <NavMobile data={navData} open={open} onClose={onClose} />
        </>
      ),
      rightArea: (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0, sm: 0.75 } }}>
          {/** @slot Searchbar */}
          {/*<Searchbar />*/}

          {/** @slot Language popover */}
          {/*<LanguagePopover data={languages} />*/}

          {/** @slot Notifications popover */}
          {/*<NotificationsPopover data={_notifications} />*/}

          {/** @slot Account drawer */}
          <AccountPopover />
        </Box>
      ),
    };

    return (
      <HeaderSection
        disableElevation
        layoutQuery={layoutQuery}
        {...slotProps?.header}
        slots={{ ...headerSlots, ...slotProps?.header?.slots }}
        slotProps={merge(headerSlotProps, slotProps?.header?.slotProps ?? {})}
        sx={slotProps?.header?.sx}
      />
    );
  };

  const renderFooter = () => null;

  const renderMain = () => <MainSection {...slotProps?.main}>{children}</MainSection>;

  const navData = getNavData({ numberOfRecordsInEachModule: navCounts, userRole: user?.role });

  return (
    <LayoutSection
      /** **************************************
       * @Header
       *************************************** */
      headerSection={renderHeader()}
      /** **************************************
       * @Sidebar
       *************************************** */
      sidebarSection={
        <NavDesktop data={navData} layoutQuery={layoutQuery} />
      }
      /** **************************************
       * @Footer
       *************************************** */
      footerSection={renderFooter()}
      /** **************************************
       * @Styles
       *************************************** */
      cssVars={{ ...dashboardLayoutVars(theme), ...cssVars }}
      sx={[
        {
          [`& .${layoutClasses.sidebarContainer}`]: {
            [theme.breakpoints.up(layoutQuery)]: {
              pl: 'var(--layout-nav-vertical-width)',
              transition: theme.transitions.create(['padding-left'], {
                easing: 'var(--layout-transition-easing)',
                duration: 'var(--layout-transition-duration)',
              }),
            },
          },
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      {renderMain()}
    </LayoutSection>
  );
}
