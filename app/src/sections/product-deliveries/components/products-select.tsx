import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import MenuItem from '@mui/material/MenuItem';
import Checkbox from '@mui/material/Checkbox';
import ListItemText from '@mui/material/ListItemText';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import { Box, Chip, Select, Collapse, InputLabel, FormControl, ListSubheader } from '@mui/material';

import type { BreweryProductListItemDto } from '../../../api/Client';

type ProductsSelectProps = {
     products: BreweryProductListItemDto[];
     selectedProducts: { productId: string; quantity: number }[];
     shouldValidate: boolean;
     onProductsChanged: (products: { productId: string; quantity: number }[]) => void;
     disabled?: boolean;
};

export function ProductsSelect({
     products,
     shouldValidate,
     selectedProducts,
     onProductsChanged,
     disabled,
}: Readonly<ProductsSelectProps>) {
     const { t } = useTranslation();

     const [productsTouched, setProductsTouched] = useState<boolean>(false);
     const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

     const toggleSection = (sectionId: string) => {
          setExpandedSections((prev) => {
               const currentState = prev[sectionId] ?? true;
               return {
                    ...prev,
                    [sectionId]: !currentState,
               };
          });
     };

     const isSectionExpanded = (sectionId: string) => expandedSections[sectionId] ?? true;

     // Seskupit produkty podle kind a pak podle packageSize
     const groupedProducts = products.reduce(
          (acc, product) => {
               const kind = product.kind || 'Other';
               const packageSize = product.packageSize || 0;

               if (!acc[kind]) {
                    acc[kind] = {};
               }
               if (!acc[kind][packageSize]) {
                    acc[kind][packageSize] = [];
               }
               acc[kind][packageSize].push(product);
               return acc;
          },
          {} as Record<string, Record<number, BreweryProductListItemDto[]>>
     );

     const sortedKinds = Object.keys(groupedProducts).sort((a, b) => {
          const kindA = parseInt(a);
          const kindB = parseInt(b);
          return kindA - kindB;
     });

     const handleItemToggle = (id?: string) => {
          if (!id) {
               return;
          }
          setProductsTouched(true);
          const isAlreadySelected = selectedProducts.some((p) => p.productId === id);

          const updated = isAlreadySelected
               ? selectedProducts.filter((p) => p.productId !== id)
               : [...selectedProducts, { productId: id, quantity: 1 }];

          onProductsChanged(updated);
     };

     return (
          <FormControl
               fullWidth
               sx={{ mt: 1 }}
               error={(productsTouched || shouldValidate) && selectedProducts.length === 0}
          >
               <InputLabel id="products-select-label">{t('products.title')}</InputLabel>
               <Select
                    disabled={disabled}
                    id="products-select"
                    multiple
                    value={selectedProducts.map((p) => p.productId)}
                    onChange={(e) => {
                         setProductsTouched(true);
                         const selectedIds = e.target.value as string[];
                         const updatedProducts = selectedIds.map((id) => {
                              const existing = selectedProducts.find((product) => product.productId === id);
                              return existing ?? { productId: id, quantity: 1 };
                         });
                         onProductsChanged(updatedProducts);
                    }}
                    renderValue={(selected) => {
                         const maxVisibleChips = 4;
                         const visibleSelected = selected.slice(0, maxVisibleChips);
                         const remainingCount = selected.length - maxVisibleChips;

                         return (
                              <Box
                                   sx={{
                                        margin: 0,
                                        display: 'flex',
                                        flexWrap: 'nowrap',
                                        gap: 0.5,
                                        overflow: 'hidden',
                                        alignItems: 'center',
                                        minWidth: 0,
                                   }}
                              >
                                   {visibleSelected.map((value) => {
                                        const product = products.find((d) => d.id === (value ?? ''));
                                        return (
                                             <Chip
                                                  key={value}
                                                  label={product?.name ?? ''}
                                                  size="small"
                                                  sx={{
                                                       flexShrink: 0,
                                                       maxWidth: '150px',
                                                       '& .MuiChip-label': {
                                                            overflow: 'hidden',
                                                            textOverflow: 'ellipsis',
                                                            whiteSpace: 'nowrap',
                                                       },
                                                  }}
                                             />
                                        );
                                   })}
                                   {remainingCount > 0 && (
                                        <Chip
                                             label={`+${remainingCount}`}
                                             size="small"
                                             variant="outlined"
                                             sx={{
                                                  flexShrink: 0,
                                                  minWidth: 'auto',
                                             }}
                                        />
                                   )}
                              </Box>
                         );
                    }}
               >
                    {sortedKinds.map((kind) => {
                         const packageSizes = Object.keys(groupedProducts[kind]).sort(
                              (a, b) => parseFloat(a) - parseFloat(b)
                         );

                         return (
                              <React.Fragment key={`kind-${kind}`}>
                                   <ListSubheader
                                        onMouseDown={(e) => {
                                             e.preventDefault();
                                             e.stopPropagation();
                                             toggleSection(`kind-${kind}`);
                                        }}
                                        sx={{
                                             fontWeight: 'bold',
                                             backgroundColor: 'background.paper',
                                             fontSize: '1.1rem',
                                             top: 0,
                                             zIndex: 4,
                                             color: 'primary.main',
                                             cursor: 'pointer',
                                             display: 'flex',
                                             alignItems: 'center',
                                             justifyContent: 'space-between',
                                             '&:hover': {
                                                  backgroundColor: 'action.hover',
                                             },
                                        }}
                                   >
                                        {t('productKind.' + kind)}
                                        {isSectionExpanded(`kind-${kind}`) ? (
                                             <KeyboardArrowUpIcon />
                                        ) : (
                                             <KeyboardArrowDownIcon />
                                        )}
                                   </ListSubheader>

                                   <Collapse in={isSectionExpanded(`kind-${kind}`)}>
                                        {packageSizes.map((packageSize) => {
                                             const size = parseFloat(packageSize);
                                             return (
                                                  <React.Fragment key={`size-${kind}-${packageSize}`}>
                                                       <ListSubheader
                                                            onMouseDown={(e) => {
                                                                 e.preventDefault();
                                                                 e.stopPropagation();
                                                                 toggleSection(`size-${kind}-${packageSize}`);
                                                            }}
                                                            sx={{
                                                                 pl: 5,
                                                                 fontWeight: 'medium',
                                                                 backgroundColor: 'background.paper',
                                                                 fontSize: '0.875rem',
                                                                 top: '48px',
                                                                 zIndex: 2,
                                                                 cursor: 'pointer',
                                                                 display: 'flex',
                                                                 alignItems: 'center',
                                                                 justifyContent: 'space-between',
                                                                 '&:hover': {
                                                                      backgroundColor: 'action.hover',
                                                                 },
                                                            }}
                                                       >
                                                            {packageSize}L
                                                            {isSectionExpanded(`size-${kind}-${packageSize}`) ? (
                                                                 <KeyboardArrowUpIcon fontSize="small" />
                                                            ) : (
                                                                 <KeyboardArrowDownIcon fontSize="small" />
                                                            )}
                                                       </ListSubheader>

                                                       <Collapse in={isSectionExpanded(`size-${kind}-${packageSize}`)}>
                                                            {groupedProducts[kind][size].map((item) => (
                                                                 <MenuItem
                                                                      key={item.id}
                                                                      value={item.id}
                                                                      sx={{ pl: 7 }}
                                                                      onClick={(e) => {
                                                                           e.stopPropagation();
                                                                           handleItemToggle(item.id);
                                                                      }}
                                                                 >
                                                                      <Checkbox
                                                                           checked={selectedProducts.some(
                                                                                (p) => p.productId === item.id
                                                                           )}
                                                                      />
                                                                      <Box
                                                                           sx={{
                                                                                display: 'grid',
                                                                                gridTemplateColumns: '2fr 1fr',
                                                                                alignItems: 'center',
                                                                                width: '100%',
                                                                                gap: 1,
                                                                           }}
                                                                      >
                                                                           <ListItemText primary={item.name} />
                                                                           <Chip
                                                                                label={t('productType.' + item.type)}
                                                                                size="small"
                                                                                sx={{ maxWidth: '100%', mr: 3 }}
                                                                           />
                                                                      </Box>
                                                                 </MenuItem>
                                                            ))}
                                                       </Collapse>
                                                  </React.Fragment>
                                             );
                                        })}
                                   </Collapse>
                              </React.Fragment>
                         );
                    })}
               </Select>
          </FormControl>
     );
}
