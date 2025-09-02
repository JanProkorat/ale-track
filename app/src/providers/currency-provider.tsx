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
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);
const czechRate = new ExchangeRateDto({
    currencyCode: "CZK",
    rate: 1
});

export const CurrencyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [selectedCurrency, setSelectedCurrency] = useState<ExchangeRateDto>(czechRate);
    const [rates, setRates] = useState<ExchangeRateDto[]>([czechRate]);
    const { t } = useTranslation();
    const {showSnackbar} = useSnackbar();
    const { user } = useAuth();

    const changeCurrency = (currencyCode: string) => {
        const found = rates.find(rate => rate.currencyCode === currencyCode);
        setSelectedCurrency(found ?? czechRate);
    };

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
            changeCurrency
        }), [selectedCurrency, rates, changeCurrency])}>
            {children}
        </CurrencyContext.Provider>
    );
};

export const useCurrency = (): CurrencyContextType => {
    const context = useContext(CurrencyContext);
    if (!context) throw new Error('useCurrency must be used within a CurrencyProvider');
    return context;
};