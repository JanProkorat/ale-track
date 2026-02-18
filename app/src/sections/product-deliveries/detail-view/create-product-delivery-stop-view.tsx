import { useTranslation } from 'react-i18next';
import { useState, useEffect, useCallback } from 'react';

import TextField from '@mui/material/TextField';
import { Box, Collapse, IconButton, Typography } from '@mui/material';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';

import { useAuthorizedClient } from 'src/api/use-authorized-client';

import { Iconify } from '../../../components/iconify';
import { useApiCall } from '../../../hooks/use-api-call';
import { BrewerySelect } from '../components/brewery-select';
import { ProductsSelect } from '../components/products-select';
import { DeliveryItemsTable } from '../components/delivery-items-table';

import type {
     BreweryDto,
     BreweryProductListItemDto,
     CreateProductDeliveryStopDto,
     CreateProductDeliveryItemDto,
} from '../../../api/Client';

type CreateProductDeliveryStopViewProps = {
     key: string;
     number: number;
     breweries: BreweryDto[];
     productDeliveryStop: CreateProductDeliveryStopDto;
     onBrewerySelected: (breweryId: string | undefined) => void;
     onNoteChanged: (note: string) => void;
     onDeleteClicked: () => void;
     onProductsChanged: (products: CreateProductDeliveryItemDto[]) => void;
     shouldValidate?: boolean;
};

export function CreateProductDeliveryStopView({
     key,
     number,
     breweries,
     productDeliveryStop,
     onBrewerySelected,
     onNoteChanged,
     onDeleteClicked,
     onProductsChanged,
     shouldValidate,
}: Readonly<CreateProductDeliveryStopViewProps>) {
     const { t } = useTranslation();
     const { executeApiCall } = useApiCall();
     const client = useAuthorizedClient();

     const [isExpanded, setIsExpanded] = useState<boolean>(true);
     const [breweryName, setBreweryName] = useState<string | undefined>(undefined);
     const [products, setProducts] = useState<BreweryProductListItemDto[]>([]);

     const fetchProducts = useCallback(
          async (breweryId: string) => {
               const result = await executeApiCall(() => client.fetchBreweryProducts(breweryId, {}));
               if (result) {
                    setProducts(result);
               }
          },
          [executeApiCall, client]
     );

     useEffect(() => {
          if (productDeliveryStop.breweryId !== undefined && productDeliveryStop.breweryId !== '') {
               void fetchProducts(productDeliveryStop.breweryId);
          }
     }, [fetchProducts, productDeliveryStop.breweryId]);

     return (
          <>
               <Box
                    key={key}
                    onClick={() => setIsExpanded((prev) => !prev)}
                    sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
               >
                    <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                         {number}. {t('productDeliveries.stop')} {breweryName === undefined ? '' : '- ' + breweryName}
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                         {isExpanded ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
                         <IconButton onClick={onDeleteClicked} color="error">
                              <Iconify icon="solar:trash-bin-trash-bold" />
                         </IconButton>
                    </Box>
               </Box>
               <Collapse in={isExpanded} sx={{ mb: 0.5 }}>
                    <Box
                         sx={{
                              display: 'flex',
                              flexDirection: 'column',
                              width: '100%',
                              pl: 2,
                              pr: 2,
                         }}
                    >
                         <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <BrewerySelect
                                   selectedBreweryId={productDeliveryStop.breweryId}
                                   breweries={breweries}
                                   shouldValidate={shouldValidate ?? false}
                                   onBrewerySelected={(breweryId, name) => {
                                        setBreweryName(breweryId == productDeliveryStop.breweryId ? undefined : name);
                                        onBrewerySelected(
                                             breweryId == productDeliveryStop.breweryId ? undefined : breweryId
                                        );
                                   }}
                              />

                              <ProductsSelect
                                   products={products}
                                   selectedProducts={(productDeliveryStop.products ?? []).map((product) => ({
                                        productId: product.productId!,
                                        quantity: product.quantity!,
                                   }))}
                                   shouldValidate={shouldValidate ?? false}
                                   onProductsChanged={(selectedProducts) =>
                                        onProductsChanged(selectedProducts as CreateProductDeliveryItemDto[])
                                   }
                              />
                         </Box>

                         <TextField
                              id="note-input"
                              label={t('productDeliveries.note')}
                              multiline
                              rows={3}
                              value={productDeliveryStop.note}
                              sx={{ mt: 2 }}
                              onChange={(event) => onNoteChanged(event.target.value)}
                              inputProps={{ maxLength: 200 }}
                         />

                         <DeliveryItemsTable
                              deliveryProducts={productDeliveryStop.products ?? []}
                              products={products}
                              onProductsChanged={onProductsChanged}
                         />
                    </Box>
               </Collapse>
          </>
     );
}
