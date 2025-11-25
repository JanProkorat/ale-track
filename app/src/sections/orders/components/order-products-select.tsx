import type { SelectChangeEvent } from '@mui/material';

import { useTranslation } from 'react-i18next';
import React, { useState, useEffect } from 'react';

import Checkbox from '@mui/material/Checkbox';
import MenuItem from '@mui/material/MenuItem';
import ListItemText from '@mui/material/ListItemText';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import { Box, Chip, Select, Collapse, InputLabel, FormControl, ListSubheader } from '@mui/material';

import type { GroupedProductHistoryDto } from '../../../api/Client';

type OrderProductsSelectProps = {
  products: GroupedProductHistoryDto;
  selectedProducts: { productId: string; quantity: number }[];
  shouldValidate: boolean;
  onProductsChanged: (products: { productId: string; quantity: number }[]) => void;
  disabled?: boolean;
};

export function OrderProductsSelect({
  products,
  shouldValidate,
  selectedProducts,
  onProductsChanged,
  disabled,
}: Readonly<OrderProductsSelectProps>) {
  const { t } = useTranslation();

  const [productsTouched, setProductsTouched] = useState<boolean>(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

  const recent = products.recent ?? [];
  const breweries = products.breweries ?? [];

  const [maxVisibleChips, setMaxVisibleChips] = useState(4);
  const containerRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return undefined;

    const calculateMaxChips = (width: number) => {
      const chipWidth = 150; // maxWidth chipu
      const gapWidth = 4; // gap mezi chipy (0.5 * 8px)
      const paddingAndBuffer = 100; // reserve for padding and "+X" chip

      const availableWidth = width - paddingAndBuffer;
      const chipsPerRow = Math.floor(availableWidth / (chipWidth + gapWidth));

      setMaxVisibleChips(Math.max(1, chipsPerRow));
    };

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const width = entry.contentRect.width;
        calculateMaxChips(width);
      }
    });

    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

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

  const handleSelectChange = (event: SelectChangeEvent<string[]>) => {
    setProductsTouched(true);
    const selectedIds = event.target.value as string[];
    const updatedProducts = selectedIds.map((id) => {
      const existing = selectedProducts.find((product) => product.productId === id);
      return existing ?? { productId: id, quantity: 1 };
    });
    onProductsChanged(updatedProducts);
  };

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
      error={(productsTouched || shouldValidate) && selectedProducts.length === 0}
    >
      <InputLabel id="order-products-select-label">{t('products.title')}</InputLabel>
      <Select
        disabled={disabled}
        id="order-products-select"
        labelId="order-products-select-label"
        multiple
        value={selectedProducts.map((p) => p.productId)}
        onChange={handleSelectChange}
        renderValue={(selected) => {
          const visibleSelected = selected.slice(0, maxVisibleChips);
          const remainingCount = selected.length - maxVisibleChips;

          return (
            <Box
              ref={containerRef}
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
                const product =
                  recent.find(d => d.id === value) ??
                  breweries.flatMap(b => b.kinds?.flatMap(k => k.packageSizes?.flatMap(s => s.items)))
                    .find(d => d?.id === value);

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
        {recent.length > 0 && (
          <React.Fragment>
            <ListSubheader
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                toggleSection('recent');
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
              {t('products.recent')}
              {isSectionExpanded('recent') ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
            </ListSubheader>

            <Collapse in={isSectionExpanded('recent')}>
              {Object.entries(
                recent.reduce((acc: any, p) => {
                  const kind = p.kind!;
                  const size = p.packageSize ?? 0;

                  if (!acc[kind]) acc[kind] = {};
                  if (!acc[kind][size]) acc[kind][size] = [];
                  acc[kind][size].push(p);

                  return acc;
                }, {})
              ).map(([kind, sizes]: any) => (
                <React.Fragment key={`recent-kind-${kind}`}>
                  <ListSubheader
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      toggleSection(`recent-kind-${kind}`);
                    }}
                    sx={{
                      pl: 3,
                      fontWeight: 'bold',
                      backgroundColor: 'background.paper',
                      fontSize: '0.95rem',
                      top: '48px',
                      zIndex: 3,
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
                    {isSectionExpanded(`recent-kind-${kind}`) ? (
                      <KeyboardArrowUpIcon fontSize="small" />
                    ) : (
                      <KeyboardArrowDownIcon fontSize="small" />
                    )}
                  </ListSubheader>

                  <Collapse in={isSectionExpanded(`recent-kind-${kind}`)}>
                    {Object.entries(sizes).map(([size, items]: any) => (
                      <React.Fragment key={`recent-size-${kind}-${size}`}>
                        <ListSubheader
                          onMouseDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            toggleSection(`recent-size-${kind}-${size}`);
                          }}
                          sx={{
                            pl: 5,
                            fontWeight: 'medium',
                            backgroundColor: 'background.paper',
                            fontSize: '0.875rem',
                            top: '96px',
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
                          {size}L
                          {isSectionExpanded(`recent-size-${kind}-${size}`) ? (
                            <KeyboardArrowUpIcon fontSize="small" />
                          ) : (
                            <KeyboardArrowDownIcon fontSize="small" />
                          )}
                        </ListSubheader>

                        <Collapse in={isSectionExpanded(`recent-size-${kind}-${size}`)}>
                          {items.map((item: any) => (
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
                                checked={selectedProducts.some((p) => p.productId === item.id)}
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
                    ))}
                  </Collapse>
                </React.Fragment>
              ))}
            </Collapse>
          </React.Fragment>
        )}

        {breweries.map((brewery) => (
          <React.Fragment key={brewery.breweryId}>
            <ListSubheader
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                toggleSection(`brewery-${brewery.breweryId}`);
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
              {brewery.breweryName}
              {isSectionExpanded(`brewery-${brewery.breweryId}`) ? (
                <KeyboardArrowUpIcon />
              ) : (
                <KeyboardArrowDownIcon />
              )}
            </ListSubheader>

            <Collapse in={isSectionExpanded(`brewery-${brewery.breweryId}`)}>
              {brewery.kinds?.map((kind) => (
                <React.Fragment key={kind.kind}>
                  <ListSubheader
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      toggleSection(`brewery-${brewery.breweryId}-kind-${kind.kind}`);
                    }}
                    sx={{
                      pl: 3,
                      fontWeight: 'bold',
                      backgroundColor: 'background.paper',
                      fontSize: '0.95rem',
                      top: '48px',
                      zIndex: 3,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      '&:hover': {
                        backgroundColor: 'action.hover',
                      },
                    }}
                  >
                    {t('productKind.' + kind.kind)}
                    {isSectionExpanded(`brewery-${brewery.breweryId}-kind-${kind.kind}`) ? (
                      <KeyboardArrowUpIcon fontSize="small" />
                    ) : (
                      <KeyboardArrowDownIcon fontSize="small" />
                    )}
                  </ListSubheader>

                  <Collapse
                    in={isSectionExpanded(`brewery-${brewery.breweryId}-kind-${kind.kind}`)}
                  >
                    {kind.packageSizes?.map((sizeGroup) => (
                      <React.Fragment key={sizeGroup.size ?? 'null'}>
                        <ListSubheader
                          onMouseDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            toggleSection(
                              `brewery-${brewery.breweryId}-kind-${kind.kind}-size-${sizeGroup.size}`
                            );
                          }}
                          sx={{
                            pl: 5,
                            fontWeight: 'medium',
                            backgroundColor: 'background.paper',
                            fontSize: '0.875rem',
                            top: '96px',
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
                          {sizeGroup.size}L
                          {isSectionExpanded(
                            `brewery-${brewery.breweryId}-kind-${kind.kind}-size-${sizeGroup.size}`
                          ) ? (
                            <KeyboardArrowUpIcon fontSize="small" />
                          ) : (
                            <KeyboardArrowDownIcon fontSize="small" />
                          )}
                        </ListSubheader>

                        <Collapse
                          in={isSectionExpanded(
                            `brewery-${brewery.breweryId}-kind-${kind.kind}-size-${sizeGroup.size}`
                          )}
                        >
                          {sizeGroup.items?.map((item) => (
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
                                checked={selectedProducts.some((p) => p.productId === item.id)}
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
                    ))}
                  </Collapse>
                </React.Fragment>
              ))}
            </Collapse>
          </React.Fragment>
        ))}
      </Select>
    </FormControl>
  );
}
