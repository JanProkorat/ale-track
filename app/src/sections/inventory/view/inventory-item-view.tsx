import {useTranslation} from "react-i18next";

import {Box, Card, Stack, Typography} from "@mui/material";

import type {InventoryItemListItemDto} from "../../../api/Client";

type InventoryItemProps = {
    item: InventoryItemListItemDto;
};

export function InventoryItemView({item}: Readonly<InventoryItemProps>) {
    const {t} = useTranslation();

    return (
        <Card>
            <Box sx={{pt: '100%', position: 'relative'}}>
                <Box
                    component="img"
                    alt={item.name}
                    src={`.//assets/images/products/${item.kind!}.png`}
                    sx={{
                        top: 0,
                        width: 1,
                        height: 1,
                        objectFit: 'cover',
                        position: 'absolute',
                    }}
                />
            </Box>

            <Stack spacing={1} sx={{p: 3}}>
                <Box
                    sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                    }}
                >
                    <Typography color="inherit" variant="subtitle2">
                        {item.name}
                    </Typography>
                    <Typography variant="subtitle1">
                        {item.quantity} Ks
                    </Typography>
                </Box>
                <Box>
                    <Box
                        sx={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                        }}
                    >
                        <Typography color="inherit" variant="caption">
                            {t('products.alcoholPercentage')}
                        </Typography>
                        <Typography variant="caption">
                            {item.alcoholPercentage} %
                        </Typography>
                    </Box>
                    <Box
                        sx={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                        }}
                    >
                        <Typography color="inherit" variant="caption">
                            {t('products.platoDegree')}
                        </Typography>
                        <Typography variant="caption">
                            {item.platoDegree ?? 0} %
                        </Typography>
                    </Box>
                    <Box
                        sx={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                        }}
                    >
                        <Typography color="inherit" variant="caption">
                            {t('products.packageSize')}
                        </Typography>
                        <Typography variant="caption">
                            {item.packageSize} L
                        </Typography>
                    </Box>
                    <Box
                        sx={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                        }}
                    >
                        <Typography color="inherit" variant="caption">
                            {t('products.priceVat')}
                        </Typography>
                        <Typography variant="caption">
                            {item.priceWithVat} Kč
                        </Typography>
                    </Box>
                </Box>
            </Stack>
        </Card>
    );
}