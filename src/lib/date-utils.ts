import { format, parseISO } from "date-fns";

/**
 * Format a date string or timestamp into a human-readable format
 * @param date Date string, timestamp, or Date object
 * @returns Formatted date string
 */
export function formatDate(date: string | number | Date): string {
  if (date instanceof Date) {
    return format(date, "PPP p"); // e.g., "April 29, 2023 at 3:45 PM"
  }
  
  if (typeof date === "string") {
    try {
      return format(parseISO(date), "PPP p");
    } catch (error) {
      console.error("Error parsing date string:", error);
      return "Invalid date";
    }
  }
  
  if (typeof date === "number") {
    try {
      return format(new Date(date), "PPP p");
    } catch (error) {
      console.error("Error parsing timestamp:", error);
      return "Invalid date";
    }
  }
  
  return "Invalid date";
}

export const  DATETIME_LOCAL_FORMAT = "yyyy-MM-dd'T'HH:mm";

/**
 * Converts a datetime-local string (YYYY-MM-DDTHH:mm) to a UNIX timestamp in seconds.
 * Returns undefined if the input string is invalid or empty.
 */
export function dateTimeLocalStringToTimestampSeconds(dateTimeLocalString?: string | null): number | undefined {
  if (!dateTimeLocalString) return undefined;
  try {
    const date = new Date(dateTimeLocalString);
    if (isNaN(date.getTime())) return undefined;
    return Math.floor(date.getTime() / 1000);
  } catch (e) {
    return undefined;
  }
}

/**
 * Converts a UNIX timestamp (in seconds) to a datetime-local string (YYYY-MM-DDTHH:mm).
 * Returns an empty string if the timestamp is invalid or empty.
 */
export function timestampSecondsToDateTimeLocalString(timestampSeconds?: number | null): string {
  if (timestampSeconds === null || timestampSeconds === undefined) return '';
  try {
    const date = new Date(timestampSeconds * 1000); // Convert seconds to milliseconds
    if (isNaN(date.getTime())) return '';
    // Format to YYYY-MM-DDTHH:mm
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  } catch (e) {
    return '';
  }
}

/**
 * Formats a date value (timestamp in seconds, ISO string, or Date object) for display.
 * Uses toLocaleString() for user-friendly output.
 * Returns 'N/A' for invalid or empty inputs.
 */
export function formatDateForDisplay(dateValue?: string | number | Date | null): string {
  if (dateValue === null || dateValue === undefined) return 'N/A';
  try {
    let date: Date;
    if (typeof dateValue === 'number') {
      date = new Date(dateValue * 1000); // Assuming timestamp in seconds
    } else {
      date = new Date(dateValue);
    }
    if (isNaN(date.getTime())) return 'Invalid Date';
    return date.toLocaleString();
  } catch (e) {
    return 'Invalid Date';
  }
}

/**
 * Converts a UNIX timestamp (in seconds) to a Date object.
 * Returns undefined if the timestamp is invalid or empty.
 */
export function timestampSecondsToDate(timestampSeconds?: number | null): Date | undefined {
  if (timestampSeconds === null || timestampSeconds === undefined) return undefined;
  try {
    const date = new Date(timestampSeconds * 1000);
    if (isNaN(date.getTime())) return undefined;
    return date;
  } catch (e) {
    return undefined;
  }
}

/**
 * Converts a Date object to a UNIX timestamp (in seconds).
 * Returns undefined if the Date object is invalid or empty.
 */
export function dateToTimestampSeconds(date?: Date | null): number | undefined {
  if (!date) return undefined;
  try {
    if (isNaN(date.getTime())) return undefined;
    return Math.floor(date.getTime() / 1000);
  } catch (e) {
    return undefined;
  }
}

/**
 * Converts a date value (timestamp in seconds or Date object) to an ISO string (YYYY-MM-DDTHH:mm:ss.sssZ).
 * Returns an empty string for invalid or null/undefined input.
 * Useful for preparing data for APIs that expect ISO strings.
 */
export function toISOStringFromTimestampOrDate(dateValue?: number | Date | null): string {
    if (dateValue === null || dateValue === undefined) return '';
    try {
        let date: Date;
        if (typeof dateValue === 'number') {
            date = new Date(dateValue * 1000); // Assuming timestamp in seconds
        } else {
            date = new Date(dateValue);
        }
        if (isNaN(date.getTime())) return '';
        return date.toISOString();
    } catch (e) {
        return '';
    }
}

/**
 * Converts a date value (timestamp in seconds or Date object) to a date string (YYYY-MM-DD).
 * Returns an empty string for invalid or null/undefined input.
 */
export function toDateString(dateValue?: number | Date | null): string {
    if (dateValue === null || dateValue === undefined) return '';
    try {
        let date: Date;
        if (typeof dateValue === 'number') {
            date = new Date(dateValue * 1000); // Assuming timestamp in seconds
        } else {
            date = new Date(dateValue);
        }
        if (isNaN(date.getTime())) return '';
        return date.toISOString().split('T')[0];
    } catch (e) {
        return '';
    }
} 