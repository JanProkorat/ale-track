import type { Column } from 'src/components/common/DataTable';
import type { ProductListItemDto } from 'src/generated/api-client';

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import AddIcon from '@mui/icons-material/Add';

import { useProducts } from 'src/hooks/useProducts';

import { useEnumLabel } from 'src/utils/enumTranslations';

import DataTable from 'src/components/common/DataTable';
import PageHeader from 'src/components/common/PageHeader';

// ---------------------------------------------------------------------------
// ProductListPage
// ---------------------------------------------------------------------------

export default function ProductListPage() {
     const { t } = useTranslation();
     const navigate = useNavigate();
     const enumLabel = useEnumLabel();
     const [search, setSearch] = useState('');

     const { data: products = [], isLoading } = useProducts(search);

     const columns: Column<ProductListItemDto>[] = [
          {
               id: 'name',
               label: t('products.name'),
               minWidth: 180,
          },
          {
               id: 'breweryName',
               label: t('products.brewery'),
               minWidth: 140,
          },
          {
               id: 'kind',
               label: t('products.kind'),
               minWidth: 100,
               render: (row) => (row.kind != null ? enumLabel.productKind(row.kind) : ''),
          },
          {
               id: 'type',
               label: t('products.type'),
               minWidth: 140,
               render: (row) => (row.type != null ? enumLabel.productType(row.type) : ''),
          },
          {
               id: 'priceWithVat',
               label: t('products.priceWithVat'),
               minWidth: 120,
               align: 'right',
               render: (row) =>
                    row.priceWithVat != null
                         ? row.priceWithVat.toLocaleString(undefined, {
                                style: 'currency',
                                currency: 'CZK',
                           })
                         : '',
          },
          {
               id: 'weight',
               label: t('products.weight'),
               minWidth: 100,
               align: 'right',
               render: (row) => (row.weight != null ? `${row.weight} kg` : ''),
          },
     ];

     return (
          <Box>
               <PageHeader
                    title={t('products.title')}
                    action={
                         <Button
                              variant="contained"
                              startIcon={<AddIcon />}
                              onClick={() => navigate('/products/new')}
                         >
                              {t('products.addProduct')}
                         </Button>
                    }
               />

               <DataTable
                    columns={columns}
                    rows={products}
                    getId={(row) => row.id ?? ''}
                    loading={isLoading}
                    searchValue={search}
                    onSearchChange={setSearch}
                    onRowClick={(row) => navigate(`/products/${row.id}`)}
               />
          </Box>
     );
}
