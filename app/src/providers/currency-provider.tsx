import {useTranslation} from "react-i18next";
import React, {useState, useEffect, useContext, createContext} from "react";

import {ExchangeRateDto} from "../api/Client";
import {useSnackbar} from "./SnackbarProvider";
import {useAuth} from "../context/AuthContext";
import {AuthorizedClient} from "../api/AuthorizedClient";

interface CurrencyContextType {
    selectedCurrency: ExchangeRateDto;
    rates: ExchangeRateDto[];
    defaultCurrency: ExchangeRateDto;
    changeCurrency: (currencyCode: string) => void;
    formatPrice: (value: number | undefined) => string;
    formatPriceValue: (value: number | undefined) => number;
    formatPriceToDefault: (value: number | undefined) => number;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);
const czechRate = new ExchangeRateDto({
    currencyCode: "CZK",
    rate: 1
});

export const CurrencyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [selectedCurrency, setSelectedCurrency] = useState<ExchangeRateDto>(() => {
        const stored = localStorage.getItem("selectedCurrency");
        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                return new ExchangeRateDto(parsed);
            } catch {
                return czechRate;
            }
        }
        return czechRate;
    });
    const [rates, setRates] = useState<ExchangeRateDto[]>([czechRate]);
    const { t } = useTranslation();
    const {showSnackbar} = useSnackbar();
    const { user } = useAuth();

    const changeCurrency = (currencyCode: string) => {
        const found = rates.find(rate => rate.currencyCode === currencyCode);
        const newCurrency = found ?? czechRate;
        setSelectedCurrency(newCurrency);
        localStorage.setItem("selectedCurrency", JSON.stringify(newCurrency));
    };

    const formatPrice = (value: number | undefined) => {
        const amount = formatPriceValue(value);
        const currency =
            selectedCurrency.currencyCode === czechRate.currencyCode
                ? "Kč"
                : "€";
        return `${amount.toFixed(2)} ${currency}`;
    }

    const formatPriceValue = (value: number | undefined) => {
        const amount =
            (value ?? 0) /
            (selectedCurrency.currencyCode === czechRate.currencyCode
                ? 1
                : selectedCurrency.rate ?? 1);
        return parseFloat(amount.toFixed(2));
    }

    const formatPriceToDefault = (value: number | undefined) => {
        const amount = ((value ?? 0) * (selectedCurrency.rate ?? 1)).toFixed(2);
        return parseFloat(amount);
    }

    useEffect(() => {
        void fetchRates(user !== null);

        const interval = setInterval(fetchRates, 24 * 60 * 60 * 1000);
        return () => clearInterval(interval);
    }, [user]);

    const fetchRates = async (userPresent: boolean) => {
        if (!userPresent) return;

        try {
            const client = new AuthorizedClient();
            const res = await client.getExchangeRatesEndpoint();
            res.push(czechRate);
            setRates(res);
        }
        catch (error) {
            console.error('Error fetching exchange rates:', error);
            showSnackbar(t('exchangeRates.fetchError'), 'error');
        }
    };

    return (
        <CurrencyContext.Provider value={React.useMemo(() => ({
            selectedCurrency,
            rates,
            defaultCurrency: czechRate,
            changeCurrency,
            formatPrice,
            formatPriceValue,
            formatPriceToDefault
        }), [selectedCurrency, rates, changeCurrency, formatPrice, formatPriceValue, formatPriceToDefault])}>
            {children}
        </CurrencyContext.Provider>
    );
};

export const useCurrency = (): CurrencyContextType => {
    const context = useContext(CurrencyContext);
    if (!context) throw new Error('useCurrency must be used within a CurrencyProvider');
    return context;
};