export const formatNumber = (num: number): string => {
    if (num === undefined || num === null) return "0";

    return new Intl.NumberFormat("en-US", {
        maximumFractionDigits: 3,
        minimumFractionDigits: 0,
    }).format(num);
}
