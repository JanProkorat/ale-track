import type {ExchangeRateDto} from "../api/Client";

export function formatPrice(
    value: number | undefined,
    selectedCurrency: ExchangeRateDto,
    defaultCurrency: ExchangeRateDto
) {
    const amount =
        (value ?? 0) /
        (selectedCurrency.currencyCode === defaultCurrency.currencyCode
            ? 1
            : selectedCurrency.rate ?? 1);
    const currency =
        selectedCurrency.currencyCode === defaultCurrency.currencyCode
            ? "Kč"
            : selectedCurrency.currencyCode;
    return `${amount.toFixed(2)} ${currency}`;
}