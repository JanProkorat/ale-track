import type {IconButtonProps} from "@mui/material/IconButton";

import {usePopover} from "minimal-shared/hooks";
import {useState, useEffect, useCallback} from "react";

import Box from "@mui/material/Box";
import Popover from "@mui/material/Popover";
import MenuList from "@mui/material/MenuList";
import IconButton from "@mui/material/IconButton";
import MenuItem, {menuItemClasses} from "@mui/material/MenuItem";

import {useCurrency} from "../../providers/currency-provider";

export type CurrencyPopoverProps = IconButtonProps & {
    data?: {
        code: string;
        icon: string;
    }[];
};

export type ExchangeRate = {
    rate: number;
    code: string;
    icon: string;
}

export function CurrencyPopover({data = [], sx, ...other}: CurrencyPopoverProps) {
    const {open, anchorEl, onClose, onOpen} = usePopover();
    const { rates, selectedCurrency, changeCurrency } = useCurrency();

    const [currencies, setCurrencies] = useState<ExchangeRate[]>([]);
    const [selectedCurrencyIcon, setSelectedCurrencyIcon] = useState<string>('');

    useEffect(() => {
        setCurrencies(rates.map((rate) => {
            const relatedData = data.find((item) => rate.currencyCode == item.code);
            return {
                rate: rate.rate,
                code: rate.currencyCode,
                icon: relatedData?.icon ?? ''
            } as ExchangeRate
        }));
        setSelectedCurrencyIcon(data?.find((item) => item.code == selectedCurrency.currencyCode)?.icon ?? '');
    }, [data, rates, selectedCurrency.currencyCode])

    const handleChangeCurrency = useCallback((newCurrencyCode: string) => {
            changeCurrency(newCurrencyCode)
            onClose();
        },
        [changeCurrency, onClose]
    );

    const renderFlag = (label?: string, icon?: string) => (
        <Box
            component="img"
            alt={label}
            src={icon}
            sx={{width: 26, height: 20, borderRadius: 0.5, objectFit: 'cover'}}
        />
    );

    const renderMenuList = () => (
        <Popover
            open={open}
            anchorEl={anchorEl}
            onClose={onClose}
            anchorOrigin={{vertical: 'bottom', horizontal: 'right'}}
            transformOrigin={{vertical: 'top', horizontal: 'right'}}
        >
            <MenuList
                sx={{
                    p: 0.5,
                    gap: 0.5,
                    width: 160,
                    minHeight: 72,
                    display: 'flex',
                    flexDirection: 'column',
                    [`& .${menuItemClasses.root}`]: {
                        px: 1,
                        gap: 2,
                        borderRadius: 0.75,
                        [`&.${menuItemClasses.selected}`]: {
                            bgcolor: 'action.selected',
                            fontWeight: 'fontWeightSemiBold',
                        },
                    },
                }}
            >
                {currencies.map((option) => (
                    <MenuItem
                        key={option.code}
                        selected={option.code === selectedCurrency.currencyCode}
                        onClick={() => handleChangeCurrency(option.code)}
                    >
                        {renderFlag(option.code, option.icon)}
                        {option.code}
                    </MenuItem>
                ))}
            </MenuList>
        </Popover>
    );

    return (
        <>
            <IconButton
                aria-label="Currencies button"
                onClick={onOpen}
                sx={[
                    (theme) => ({
                        p: 0,
                        width: 40,
                        height: 40,
                        ...(open && {bgcolor: theme.vars.palette.action.selected}),
                    }),
                    ...(Array.isArray(sx) ? sx : [sx]),
                ]}
                {...other}
            >
                {renderFlag(selectedCurrency.currencyCode, selectedCurrencyIcon)}
            </IconButton>

            {renderMenuList()}
        </>
    );
}
