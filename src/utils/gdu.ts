import { DEFAULT_BASE_TEMP, DEFAULT_UPPER_TEMP } from "../constants";

export interface DailyTemp {
  date: string;
  temperatureMax: number;
  temperatureMin: number;
}

export interface DailyGduResult {
  date: string;
  temperatureMax: number;
  temperatureMin: number;
  gdu: number;
}

export interface CumulativeGduResult {
  days: DailyGduResult[];
  cumulativeGdu: number;
  startDate: string;
  endDate: string;
}

/**
 * Calculate GDU for a single day using the modified sine method.
 *
 * cappedMax = min(Tmax, upperTemp)
 * adjustedMin = max(Tmin, baseTemp)
 * dailyGDU = max(((cappedMax + adjustedMin) / 2) - baseTemp, 0)
 */
export function calculateDailyGdu(
  tMax: number,
  tMin: number,
  baseTemp = DEFAULT_BASE_TEMP,
  upperTemp = DEFAULT_UPPER_TEMP
): number {
  const cappedMax = Math.min(tMax, upperTemp);
  const adjustedMin = Math.max(tMin, baseTemp);
  return Math.max((cappedMax + adjustedMin) / 2 - baseTemp, 0);
}

/**
 * Calculate cumulative GDU from an array of daily temperatures.
 */
export function calculateCumulativeGdu(
  days: DailyTemp[],
  baseTemp = DEFAULT_BASE_TEMP,
  upperTemp = DEFAULT_UPPER_TEMP
): CumulativeGduResult {
  let cumulativeGdu = 0;
  const results: DailyGduResult[] = days.map((day) => {
    const gdu = calculateDailyGdu(
      day.temperatureMax,
      day.temperatureMin,
      baseTemp,
      upperTemp
    );
    cumulativeGdu += gdu;
    return {
      date: day.date,
      temperatureMax: day.temperatureMax,
      temperatureMin: day.temperatureMin,
      gdu: Math.round(gdu * 10) / 10,
    };
  });

  return {
    days: results,
    cumulativeGdu: Math.round(cumulativeGdu * 10) / 10,
    startDate: days[0]?.date ?? "",
    endDate: days[days.length - 1]?.date ?? "",
  };
}

/**
 * Average the daily GDU values across multiple years of data
 * to produce a "normal" for each calendar day.
 */
export function averageDailyGduAcrossYears(
  yearlyData: DailyTemp[][],
  baseTemp = DEFAULT_BASE_TEMP,
  upperTemp = DEFAULT_UPPER_TEMP
): { averageDailyGdus: number[]; cumulativeNormal: number } {
  if (yearlyData.length === 0) return { averageDailyGdus: [], cumulativeNormal: 0 };

  // All years should have the same number of days (same calendar range)
  const numDays = yearlyData[0].length;
  const averageDailyGdus: number[] = [];
  let cumulativeNormal = 0;

  for (let d = 0; d < numDays; d++) {
    let sum = 0;
    let count = 0;
    for (const yearDays of yearlyData) {
      if (d < yearDays.length) {
        sum += calculateDailyGdu(
          yearDays[d].temperatureMax,
          yearDays[d].temperatureMin,
          baseTemp,
          upperTemp
        );
        count++;
      }
    }
    const avg = count > 0 ? sum / count : 0;
    averageDailyGdus.push(Math.round(avg * 10) / 10);
    cumulativeNormal += avg;
  }

  return {
    averageDailyGdus,
    cumulativeNormal: Math.round(cumulativeNormal * 10) / 10,
  };
}
