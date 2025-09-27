export function mapEnumValue<T>(enumObj: any, value: any): T | undefined {
    if (value == null) return undefined;
    if (typeof value === 'number') return value as T;
    if (typeof value === 'string' && enumObj[value] !== undefined) return enumObj[value] as T;
    const num = Number(value);
    if (!isNaN(num) && enumObj[num] !== undefined) return num as T;
    return undefined;
}

export function mapEnumFromString<T>(enumObj: any, value: string): T | undefined {
    if (!value) return undefined;
    if (enumObj[value] !== undefined) {
        return enumObj[value] as T;
    }
    return undefined;
}