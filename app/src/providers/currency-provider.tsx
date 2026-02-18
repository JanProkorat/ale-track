import React, {useState, useEffect, useContext, useCallback, createContext} from "react";

import {ExchangeRateDto} from "../api/Client";
import {useAuth} from "../context/AuthContext";
import {useApiCall} from "../hooks/use-api-call";
import {useAuthorizedClient} from "../api/use-authorized-client";

interface CurrencyContextType {
    selectedCurrency: ExchangeRateDto;
    rates: ExchangeRateDto[];
    defaultCurrency: ExchangeRateDto;
    changeCurrency: (currencyCode: string) => void;
    formatPrice: (value: number | undefined) => string;
    formatPriceValue: (value: number | undefined) => number | undefined;
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
            const parsed = JSON.parse(stored);
            return new ExchangeRateDto(parsed);
        }
        return czechRate;
    });
    const [rates, setRates] = useState<ExchangeRateDto[]>([czechRate]);
    const { user } = useAuth();
    const { executeApiCallWithDefault } = useApiCall();
    const client = useAuthorizedClient();

    const changeCurrency = useCallback((currencyCode: string) => {
        const found = rates.find(rate => rate.currencyCode === currencyCode);
        const newCurrency = found ?? czechRate;
        setSelectedCurrency(newCurrency);
        localStorage.setItem("selectedCurrency", JSON.stringify(newCurrency));
    }, [rates]);

    const formatPriceValue = useCallback((value: number | undefined) => {
        if (!value)
            return undefined;

        const amount =
            (value ?? 0) /
            (selectedCurrency.currencyCode === czechRate.currencyCode
                ? 1
                : selectedCurrency.rate ?? 1);
        return parseFloat(amount.toFixed(2));
    }, [selectedCurrency]);

    const formatPrice = useCallback((value: number | undefined) => {
        const amount = formatPriceValue(value);
        const currency =
            selectedCurrency.currencyCode === czechRate.currencyCode
                ? "Kč"
                : "€";
        return `${amount?.toFixed(2) ?? ""} ${amount !== undefined ? currency : ""}`;
    }, [selectedCurrency, formatPriceValue]);

    const formatPriceToDefault = useCallback((value: number | undefined) => {
        const amount = ((value ?? 0) * (selectedCurrency.rate ?? 1)).toFixed(2);
        return parseFloat(amount);
    }, [selectedCurrency]);

    const fetchRates = useCallback(async (userPresent: boolean) => {
        if (!userPresent) return;

        const res = await executeApiCallWithDefault(() => client.getExchangeRatesEndpoint(), []);
        res.push(czechRate);
        setRates(res);
    }, [executeApiCallWithDefault]);

    useEffect(() => {
        void fetchRates(user !== null);

        const interval = setInterval(() => fetchRates(user !== null), 24 * 60 * 60 * 1000);
        return () => clearInterval(interval);
    }, [user, fetchRates]);

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