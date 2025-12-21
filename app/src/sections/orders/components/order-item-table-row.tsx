import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import Box from '@mui/material/Box';
import { Chip } from '@mui/material';
import Menu from '@mui/material/Menu';
import Tooltip from '@mui/material/Tooltip';
import TableRow from '@mui/material/TableRow';
import Checkbox from '@mui/material/Checkbox';
import MenuItem from '@mui/material/MenuItem';
import TableCell from '@mui/material/TableCell';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import NotificationAddIcon from '@mui/icons-material/NotificationAdd';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';

import { Iconify } from '../../../components/iconify';
import { OrderItemReminderState } from '../../../api/Client';
import { mapEnumValue } from '../../../utils/format-enum-value';

import type { ProductListItemDto } from '../../../api/Client';

type OrderItemTableRowProps = {
  row: ProductListItemDto;
  quantity: number | undefined;
  reminderState: OrderItemReminderState | null;
  onDeleteClick: () => void;
  onQuantityChange: (quantity: number | undefined) => void;
  disabled?: boolean;
  onReminderStateChanged: (state: OrderItemReminderState | null) => void;
};

export function OrderItemTableRow({
  row,
  quantity,
  reminderState,
  onDeleteClick,
  onQuantityChange,
  disabled,
  onReminderStateChanged,
}: Readonly<OrderItemTableRowProps>) {
  const [selected, setSelected] = useState<boolean>(false);
  const [isHovered, setIsHovered] = useState<boolean>(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const { t } = useTranslation();

  const handleMenuClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  return (
    <TableRow
      tabIndex={-1}
      role="checkbox"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      sx={{
        cursor: 'pointer',
      }}
    >
      <TableCell
        padding="checkbox"
        sx={{
          position: 'sticky !important',
          left: '0 !important',
          zIndex: '100 !important',
          backgroundColor: isHovered ? '#f5f5f5 !important' : '#fff !important',
          backgroundImage: 'none !important',
          transition: 'background-color 150ms cubic-bezier(0.4, 0, 0.2, 1) 0ms',
          boxShadow: '2px 0 5px -2px rgba(0, 0, 0, 0.1)',
        }}
      >
        <Checkbox
          disableRipple
          checked={selected}
          onChange={(event: any) => {
            event.stopPropagation();
            setSelected(!selected);
          }}
        />
      </TableCell>
      <TableCell
        sx={{
          whiteSpace: 'nowrap',
          minWidth: 'fit-content',
          position: 'sticky !important',
          left: '42px !important',
          zIndex: '100 !important',
          backgroundColor: isHovered ? '#f5f5f5 !important' : '#fff !important',
          backgroundImage: 'none !important',
          transition: 'background-color 150ms cubic-bezier(0.4, 0, 0.2, 1) 0ms',
          boxShadow: '2px 0 5px -2px rgba(0, 0, 0, 0.1)',
        }}
      >
        {row.name}
      </TableCell>
      <TableCell
        sx={{
          whiteSpace: 'nowrap',
          minWidth: 'fit-content',
          backgroundColor: isHovered ? 'rgba(0, 0, 0, 0.04)' : 'transparent',
          transition: 'background-color 150ms cubic-bezier(0.4, 0, 0.2, 1) 0ms',
        }}
      >
        <TextField
          disabled={disabled}
          variant="outlined"
          type="number"
          value={quantity ?? ''}
          error={quantity === undefined || quantity === 0}
          sx={{ backgroundColor: 'white' }}
          onChange={(event) => {
            const val = event.target.value;
            onQuantityChange(val === '' ? undefined : Number(val));
          }}
        />
      </TableCell>
      <TableCell
        sx={{
          whiteSpace: 'nowrap',
          minWidth: 'fit-content',
          backgroundColor: isHovered ? 'rgba(0, 0, 0, 0.04)' : 'transparent',
          transition: 'background-color 150ms cubic-bezier(0.4, 0, 0.2, 1) 0ms',
        }}
      >
        <Chip label={t('productKind.' + row.kind)} />
      </TableCell>
      <TableCell
        sx={{
          whiteSpace: 'nowrap',
          minWidth: 'fit-content',
          backgroundColor: isHovered ? 'rgba(0, 0, 0, 0.04)' : 'transparent',
          transition: 'background-color 150ms cubic-bezier(0.4, 0, 0.2, 1) 0ms',
        }}
      >
        {row.packageSize} L
      </TableCell>
      <TableCell
        sx={{
          whiteSpace: 'nowrap',
          minWidth: 'fit-content',
          backgroundColor: isHovered ? 'rgba(0, 0, 0, 0.04)' : 'transparent',
          transition: 'background-color 150ms cubic-bezier(0.4, 0, 0.2, 1) 0ms',
        }}
      >
        {row.weight} Kg
      </TableCell>
      <TableCell
        sx={{
          whiteSpace: 'nowrap',
          minWidth: 'fit-content',
          backgroundColor: isHovered ? 'rgba(0, 0, 0, 0.04)' : 'transparent',
          transition: 'background-color 150ms cubic-bezier(0.4, 0, 0.2, 1) 0ms',
        }}
      >
        {row.priceWithVat} Kč
      </TableCell>
      <TableCell
        sx={{
          whiteSpace: 'nowrap',
          minWidth: 'fit-content',
          backgroundColor: isHovered ? 'rgba(0, 0, 0, 0.04)' : 'transparent',
          transition: 'background-color 150ms cubic-bezier(0.4, 0, 0.2, 1) 0ms',
        }}
      >
        {row.priceForUnitWithVat} Kč
      </TableCell>
      <TableCell
        sx={{
          whiteSpace: 'nowrap',
          minWidth: 'fit-content',
          backgroundColor: isHovered ? 'rgba(0, 0, 0, 0.04)' : 'transparent',
          transition: 'background-color 150ms cubic-bezier(0.4, 0, 0.2, 1) 0ms',
        }}
      >
        <Chip label={t('productType.' + row.type)} />
      </TableCell>

      <TableCell
        align="right"
        sx={{
          backgroundColor: isHovered ? 'rgba(0, 0, 0, 0.04)' : 'transparent',
          transition: 'background-color 150ms cubic-bezier(0.4, 0, 0.2, 1) 0ms',
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
          {(reminderState === null || reminderState === undefined) && (
            <Tooltip title={t('reminders.addOrderItemReminder')}>
              <IconButton onClick={() => onReminderStateChanged(OrderItemReminderState.Added)}>
                <NotificationAddIcon />
              </IconButton>
            </Tooltip>
          )}
          {mapEnumValue(OrderItemReminderState, reminderState) === OrderItemReminderState.Added && (
            <>
              <Tooltip title={t('reminders.editOrderItemReminder')}>
                <IconButton onClick={handleMenuClick}>
                  <NotificationsActiveIcon />
                </IconButton>
              </Tooltip>
              <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleMenuClose}>
                <MenuItem
                  onClick={() => {
                    onReminderStateChanged(OrderItemReminderState.Resolved);
                    handleMenuClose();
                  }}
                >
                  <Box sx={{ color: 'success.main', mr: 1, mt: 1 }}>
                    <Iconify icon="eva:checkmark-fill" />
                  </Box>
                  <Typography variant="subtitle2" noWrap>
                    {t('reminders.setResolved')}
                  </Typography>
                </MenuItem>
                <MenuItem
                  onClick={() => {
                    onReminderStateChanged(null);
                    handleMenuClose();
                  }}
                >
                  <Box sx={{ color: 'error.main', mr: 1, mt: 1 }}>
                    <Iconify icon="solar:trash-bin-trash-bold" />
                  </Box>
                  <Typography variant="subtitle2" noWrap>
                    {t('common.delete')}
                  </Typography>
                </MenuItem>
              </Menu>
            </>
          )}
          {mapEnumValue(OrderItemReminderState, reminderState) ===
            OrderItemReminderState.Resolved && (
            <IconButton onClick={() => onReminderStateChanged(null)}>
              <CheckCircleIcon />
            </IconButton>
          )}

          <IconButton onClick={onDeleteClick} disabled={disabled} color="error">
            <Iconify icon="solar:trash-bin-trash-bold" />
          </IconButton>
        </Box>
      </TableCell>
    </TableRow>
  );
}
