import React from "react";

import FactoryTwoToneIcon from '@mui/icons-material/FactoryTwoTone';
import ArchiveTwoToneIcon from '@mui/icons-material/ArchiveTwoTone';
import InventoryTwoToneIcon from '@mui/icons-material/InventoryTwoTone';
import UploadFileTwoToneIcon from '@mui/icons-material/UploadFileTwoTone';
import ShoppingCartTwoToneIcon from '@mui/icons-material/ShoppingCartTwoTone';
import LocalShippingTwoToneIcon from '@mui/icons-material/LocalShippingTwoTone';
import AccountCircleTwoToneIcon from '@mui/icons-material/AccountCircleTwoTone';

import {Label} from 'src/components/label';
import {SvgColor} from 'src/components/svg-color';

import {UserRoleType} from "../api/Client";

import type {NumberOfRecordsInEachModuleDto} from "../api/Client";

// ----------------------------------------------------------------------

const icon = (name: string) => <SvgColor src={`/assets/icons/navbar/${name}.svg`} />;

export type NavItem = {
  title: string;
  path: string;
  icon: React.ReactNode;
  info?: React.ReactNode;
  allowedRoles: UserRoleType[];
};

export type NavDataProps = {
  numberOfRecordsInEachModule: NumberOfRecordsInEachModuleDto | undefined;
  userRole: UserRoleType | undefined;
}

export const getNavData = ({numberOfRecordsInEachModule, userRole}: NavDataProps): NavItem[] => {
  const menuItems: NavItem[] = [
    {
      title: 'Dashboard',
      path: '/dashboard',
      icon: icon('ic-analytics'),
      allowedRoles: [UserRoleType.User, UserRoleType.Admin]
    },
    {
      title: 'clients.title',
      path: '/clients',
      icon: icon('ic-clients'),
      info: numberOfRecordsInEachModule?.clientsCount !== undefined ? (
          <Label color="error" variant="inverted">
            {numberOfRecordsInEachModule.clientsCount}
          </Label>
      ) : undefined,
      allowedRoles: [UserRoleType.User, UserRoleType.Admin]
    },
    {
      title: 'orders.title',
      path: '/orders',
      icon: <ShoppingCartTwoToneIcon />,
      allowedRoles: [UserRoleType.User, UserRoleType.Admin]
    },
    {
      title: 'breweries.title',
      path: '/breweries',
      icon:  <FactoryTwoToneIcon/>,
      info: numberOfRecordsInEachModule?.breweriesCount !== undefined ? (
          <Label color="error" variant="inverted">
            {numberOfRecordsInEachModule.breweriesCount}
          </Label>
      ) : undefined,
      allowedRoles: [UserRoleType.User, UserRoleType.Admin]
    },
    {
      title: 'Sklad',
      path: '/inventory',
      icon: <InventoryTwoToneIcon />,
      info: numberOfRecordsInEachModule?.inventoryItemsCount !== undefined ? (
          <Label color="error" variant="inverted">
            {numberOfRecordsInEachModule.inventoryItemsCount}
          </Label>
      ) : undefined,
      allowedRoles: [UserRoleType.User, UserRoleType.Admin]
    },
    {
      title: 'drivers.title',
      path: '/drivers',
      icon: icon('ic-drivers'),
      info: numberOfRecordsInEachModule?.driversCount !== undefined ? (
          <Label color="error" variant="inverted">
            {numberOfRecordsInEachModule.driversCount}
          </Label>
      ) : undefined,
      allowedRoles: [UserRoleType.User, UserRoleType.Admin]
    },
    {
      title: 'Vozidla',
      path: '/vehicles',
      icon: <LocalShippingTwoToneIcon />,
      info: numberOfRecordsInEachModule?.vehiclesCount !== undefined ? (
          <Label color="error" variant="inverted">
            {numberOfRecordsInEachModule.vehiclesCount}
          </Label>
      ) : undefined,
      allowedRoles: [UserRoleType.User, UserRoleType.Admin]
    },
    {
      title: 'Vývozy',
      path: '/404',
      icon: <UploadFileTwoToneIcon />,
      allowedRoles: [UserRoleType.User, UserRoleType.Admin]
    },
    {
      title: 'Dovážky zboží',
      path: '/product-deliveries',
      icon: <ArchiveTwoToneIcon />,
      allowedRoles: [UserRoleType.User, UserRoleType.Admin]
    },
    {
      title: 'Uživatelé',
      path: '/users',
      icon: <AccountCircleTwoToneIcon />,
      info: numberOfRecordsInEachModule?.usersCount !== undefined ? (
          <Label color="error" variant="inverted">
            {numberOfRecordsInEachModule.usersCount}
          </Label>
      ) : undefined,
      allowedRoles: [UserRoleType.Admin]
    }
  ];
  
  return menuItems.filter((menuItem) => {
    const numericState = UserRoleType[userRole as unknown as keyof typeof UserRoleType];
    return menuItem.allowedRoles.includes(numericState)
  });
}
