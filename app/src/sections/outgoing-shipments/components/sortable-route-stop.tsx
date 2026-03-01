import { CSS } from '@dnd-kit/utilities';
import { useSortable } from '@dnd-kit/sortable';

import Box from '@mui/material/Box';
import { Radio, Stack, Collapse, IconButton, Typography } from '@mui/material';

import { Iconify } from 'src/components/iconify';

import { mapEnumValue } from '../../../utils/format-enum-value';
import { OutgoingShipmentStopAddressKind } from '../../../api/Client';

import type { AddressDto } from '../../../api/Client';

type SortableRouteStopProps = {
     id: string;
     clientName: string;
     clientOfficialAddress: AddressDto;
     clientContactAddress: AddressDto | undefined;
     isExpanded: boolean;
     selectedAddressType: OutgoingShipmentStopAddressKind;
     onToggle: () => void;
     onAddressSelect: (addressType: OutgoingShipmentStopAddressKind) => void;
     formatAddressMultiline: (address: AddressDto) => { street: string; cityLine: string };
     t: (key: string) => string;
};

export function SortableRouteStop({
     id,
     clientName,
     clientOfficialAddress,
     clientContactAddress,
     isExpanded,
     selectedAddressType,
     onToggle,
     onAddressSelect,
     formatAddressMultiline,
     t,
}: SortableRouteStopProps) {
     const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
          id,
     });

     const style = {
          transform: CSS.Transform.toString(transform),
          transition,
          zIndex: isDragging ? 10 : 'auto',
     };

     const renderAddressOption = (addressType: OutgoingShipmentStopAddressKind, address: AddressDto, label: string) => (
          <Box
               onClick={() => onAddressSelect(addressType)}
               sx={{
                    display: 'flex',
                    alignItems: 'center',
                    cursor: 'pointer',
                    borderRadius: 1,
                    '&:hover': {
                         backgroundColor: '#f0f0f0',
                    },
               }}
          >
               <Radio
                    checked={mapEnumValue(OutgoingShipmentStopAddressKind, selectedAddressType) === addressType}
                    size="small"
               />
               <Box sx={{ ml: 1, flex: 1 }}>
                    <Typography variant="body2" sx={{ fontWeight: 500, mb: 0.5 }}>
                         {label}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                         {formatAddressMultiline(address).street}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                         {formatAddressMultiline(address).cityLine}
                    </Typography>
               </Box>
          </Box>
     );

     return (
          <Box
               ref={setNodeRef}
               sx={{
                    ...style,
                    mb: 1,
                    border: '1px solid #e0e0e0',
                    borderRadius: 1,
                    overflow: 'hidden',
                    backgroundColor: 'background.paper',
                    boxShadow: isDragging ? 4 : 0,
               }}
          >
               <Box
                    sx={{
                         display: 'flex',
                         alignItems: 'center',
                         justifyContent: 'space-between',
                         p: 2,
                         backgroundColor: '#f5f5f5',
                         '&:hover': {
                              backgroundColor: '#eeeeee',
                         },
                    }}
               >
                    <Box
                         {...attributes}
                         {...listeners}
                         sx={{
                              cursor: 'grab',
                              display: 'flex',
                              alignItems: 'center',
                              mr: 2,
                              '&:active': {
                                   cursor: 'grabbing',
                              },
                         }}
                    >
                         <Iconify icon={'mdi:drag-vertical' as any} width={24} />
                    </Box>
                    <Typography variant="body1" sx={{ fontWeight: 500, flex: 1 }}>
                         {clientName}
                    </Typography>
                    <IconButton size="small" onClick={onToggle} sx={{ ml: 1 }}>
                         <Iconify
                              icon={(isExpanded ? 'eva:chevron-up-fill' : 'eva:chevron-down-fill') as any}
                              width={20}
                         />
                    </IconButton>
               </Box>
               <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                    <Box sx={{ p: 2, backgroundColor: '#fafafa' }}>
                         <Stack spacing={1}>
                              {renderAddressOption(
                                   OutgoingShipmentStopAddressKind.Official,
                                   clientOfficialAddress,
                                   t('address.officialAddress')
                              )}
                              {clientContactAddress &&
                                   renderAddressOption(
                                        OutgoingShipmentStopAddressKind.Contact,
                                        clientContactAddress,
                                        t('address.contactAddress')
                                   )}
                         </Stack>
                    </Box>
               </Collapse>
          </Box>
     );
}
