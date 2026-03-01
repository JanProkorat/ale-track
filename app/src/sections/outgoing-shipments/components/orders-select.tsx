import { useTranslation } from 'react-i18next';
import React, { useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import MenuItem from '@mui/material/MenuItem';
import Checkbox from '@mui/material/Checkbox';
import ListItemText from '@mui/material/ListItemText';
import { Chip, Stack, Select, Collapse, InputLabel, Typography, IconButton, FormControl } from '@mui/material';

import { Iconify } from 'src/components/iconify';

import { formatDate } from '../../../locales/formatDate';

import type { ClientOrderShipmentDto, OutgoingShipmentOrderDto } from '../../../api/Client';

type OrdersSelectProps = {
     orders: OutgoingShipmentOrderDto[];
     selectedOrders: ClientOrderShipmentDto[];
     shouldValidate: boolean;
     disabled?: boolean;
     onSelect: (orders: [string, number][]) => void;
};

export function OrdersSelect({
     disabled,
     orders,
     selectedOrders,
     shouldValidate,
     onSelect,
}: Readonly<OrdersSelectProps>) {
     const { t } = useTranslation();

     const [showDetails, setShowDetails] = useState<Record<string, boolean>>({});

     useEffect(() => {
          // Initialize all orders to show details by default
          const initialShowDetails: Record<string, boolean> = {};
          orders.forEach((order) => {
               if (order.id) {
                    initialShowDetails[order.id] = true;
               }
          });
          setShowDetails(initialShowDetails);
     }, [orders]);

     return (
          <FormControl
               disabled={disabled}
               fullWidth
               sx={{ mt: 1 }}
               error={shouldValidate && selectedOrders.length === 0}
          >
               <InputLabel id="shipment-orders-select-label">{t('outgoingShipments.orders')}</InputLabel>
               <Select
                    multiple
                    disabled={disabled}
                    value={selectedOrders.map((order) => order.clientOrderId)}
                    onChange={(e) => {
                         const selectedOrderIds = e.target.value as string[];
                         const ordersWithWeights: [string, number][] = selectedOrderIds.map((orderId) => {
                              const order = orders.find((o) => o.id === orderId);
                              const totalWeight =
                                   order?.items?.reduce(
                                        (sum, item) => sum + (item.weight || 0) * (item.quantity || 0),
                                        0
                                   ) || 0;
                              return [orderId, totalWeight];
                         });
                         onSelect(ordersWithWeights);
                    }}
                    renderValue={(selected) => (
                         <Box
                              sx={{
                                   margin: 0,
                                   display: 'flex',
                                   flexWrap: 'nowrap',
                                   gap: 0.5,
                                   overflow: 'hidden',
                                   textOverflow: 'ellipsis',
                                   whiteSpace: 'nowrap',
                                   maxWidth: '100%',
                                   alignItems: 'center',
                              }}
                         >
                              {selected.map((value) => {
                                   const order = orders.find((d) => d.id === value);
                                   return (
                                        <Chip
                                             key={value}
                                             label={
                                                  order?.clientName +
                                                  (order?.requiredDeliveryDate
                                                       ? ' - ' + formatDate(order?.requiredDeliveryDate)
                                                       : '')
                                             }
                                             size="small"
                                             sx={{ maxWidth: '100%' }}
                                        />
                                   );
                              })}
                         </Box>
                    )}
               >
                    {orders.map((order) => (
                         <MenuItem key={order.id} value={order.id}>
                              <Checkbox checked={selectedOrders.map((o) => o.clientOrderId)!.includes(order.id!)} />
                              <ListItemText
                                   primary={
                                        <Box
                                             sx={{
                                                  display: 'flex',
                                                  alignItems: 'center',
                                                  justifyContent: 'space-between',
                                                  width: '100%',
                                             }}
                                        >
                                             <Typography variant="body1">
                                                  {order.clientName +
                                                       (order.requiredDeliveryDate
                                                            ? ' - ' + formatDate(order.requiredDeliveryDate)
                                                            : '')}
                                             </Typography>
                                             {order.items && order.items.length > 0 && (
                                                  <IconButton
                                                       size="small"
                                                       onClick={(e) => {
                                                            e.stopPropagation();
                                                            setShowDetails((prev) => ({
                                                                 ...prev,
                                                                 [order.id!]: !prev[order.id!],
                                                            }));
                                                       }}
                                                       sx={{ ml: 1 }}
                                                  >
                                                       <Iconify
                                                            icon={
                                                                 (showDetails[order.id!]
                                                                      ? 'eva:chevron-up-fill'
                                                                      : 'eva:chevron-down-fill') as any
                                                            }
                                                            width={20}
                                                       />
                                                  </IconButton>
                                             )}
                                        </Box>
                                   }
                                   secondary={
                                        order.items && order.items.length > 0 ? (
                                             <Collapse in={showDetails[order.id!]} timeout="auto" unmountOnExit>
                                                  <Stack spacing={0.5} sx={{ mt: 0.5, ml: 2 }}>
                                                       {order.items.map((item, index) => (
                                                            <Typography
                                                                 key={index}
                                                                 variant="body2"
                                                                 component="span"
                                                                 sx={{ display: 'block' }}
                                                            >
                                                                 •&nbsp;&nbsp;{item.productName} ({item.quantity}x{' '}
                                                                 {t('productKind.' + item.kind)} {item.packageSize}L{' '}
                                                                 {t('productType.' + item.type)} {item.weight}Kg)
                                                            </Typography>
                                                       ))}
                                                  </Stack>
                                             </Collapse>
                                        ) : null
                                   }
                              />
                         </MenuItem>
                    ))}
               </Select>
          </FormControl>
     );
}
