// تبدیل تاریخ میلادی به شمسی
export function gregorianToPersian(gregorianDate: string): string {
  const date = new Date(gregorianDate)

  const persianDate = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Baghdad",
  }).format(date)

  return persianDate
}

export function gregorianToPersianWithTime(gregorianDate: string): string {
  const date = new Date(gregorianDate)

  const persianDate = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Baghdad",
  }).format(date)

  return persianDate
}

export const formatPersianDate = gregorianToPersian

// فرمت کردن تاریخ میلادی
export function formatGregorianDate(gregorianDate: string): string {
  const date = new Date(gregorianDate)

  return date.toLocaleDateString("en-GB", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Baghdad",
  })
}

export function formatGregorianDateWithTime(gregorianDate: string): string {
  const date = new Date(gregorianDate)

  return date.toLocaleString("en-GB", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Baghdad",
  })
}

// نمایش هم تاریخ میلادی و هم شمسی
export function formatBothDates(gregorianDate: string): { persian: string; gregorian: string } {
  return {
    persian: gregorianToPersian(gregorianDate),
    gregorian: formatGregorianDate(gregorianDate),
  }
}

export function formatBothDatesWithTime(gregorianDate: string): { persian: string; gregorian: string } {
  return {
    persian: gregorianToPersianWithTime(gregorianDate),
    gregorian: formatGregorianDateWithTime(gregorianDate),
  }
}
