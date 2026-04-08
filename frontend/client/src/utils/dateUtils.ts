import dayjs from 'dayjs';

/**
 * Utility functions for consistent date/time handling across the application
 * Ensures that entryDate takes precedence over createdAt for display purposes
 */

/**
 * Gets the effective date for an entry (entryDate takes precedence over createdAt)
 * @param entry - The entry object
 * @returns The effective date string
 */
export const getEffectiveEntryDate = (entry: any): string => {
  return entry?.entryDate || entry?.createdAt || '';
};

/**
 * Gets the formatted effective date for display
 * @param entry - The entry object
 * @param format - The dayjs format string (default: 'DD/MM/YY')
 * @returns The formatted date string
 */
export const getFormattedEntryDate = (entry: any, format: string = 'DD/MM/YY'): string => {
  const effectiveDate = getEffectiveEntryDate(entry);
  return effectiveDate ? dayjs(effectiveDate).format(format) : '';
};

/**
 * Gets the formatted effective time for display
 * @param entry - The entry object
 * @param format - The dayjs format string (default: 'hh:mm A')
 * @returns The formatted time string
 */
export const getFormattedEntryTime = (entry: any, format: string = 'hh:mm A'): string => {
  const effectiveDate = getEffectiveEntryDate(entry);
  return effectiveDate ? dayjs(effectiveDate).format(format) : '';
};

/**
 * Gets the formatted effective date and time for display
 * @param entry - The entry object
 * @param format - The dayjs format string (default: 'DD/MM/YY hh:mm A')
 * @returns The formatted date-time string
 */
export const getFormattedEntryDateTime = (entry: any, format: string = 'DD/MM/YY hh:mm A'): string => {
  const effectiveDate = getEffectiveEntryDate(entry);
  return effectiveDate ? dayjs(effectiveDate).format(format) : '';
};

/**
 * Checks if an entry is for today based on the effective date
 * @param entry - The entry object
 * @returns True if the entry is for today
 */
export const isEntryToday = (entry: any): boolean => {
  const effectiveDate = getEffectiveEntryDate(entry);
  return effectiveDate ? dayjs(effectiveDate).isSame(dayjs(), 'day') : false;
};

/**
 * Checks if an entry is for yesterday based on the effective date
 * @param entry - The entry object
 * @returns True if the entry is for yesterday
 */
export const isEntryYesterday = (entry: any): boolean => {
  const effectiveDate = getEffectiveEntryDate(entry);
  return effectiveDate ? dayjs(effectiveDate).isSame(dayjs().subtract(1, 'day'), 'day') : false;
};

/**
 * Gets the effective date for database queries (entryDate takes precedence over createdAt)
 * @param entry - The entry object
 * @returns The date object for database operations
 */
export const getEffectiveDateForDB = (entry: any): Date => {
  const effectiveDate = getEffectiveEntryDate(entry);
  return effectiveDate ? new Date(effectiveDate) : new Date();
};

/**
 * Prepares entry data for API updates ensuring proper date handling
 * @param entry - The entry object
 * @returns The prepared entry data for API
 */
export const prepareEntryForAPI = (entry: any): any => {
  return {
    ...entry,
    // Ensure entryDate is properly formatted for the backend
    entryDate: entry.entryDate ? new Date(entry.entryDate).toISOString() : undefined
  };
};

/**
 * Validates if a date string is a valid date
 * @param dateString - The date string to validate
 * @returns True if the date string is valid
 */
export const isValidDateString = (dateString: string): boolean => {
  return dayjs(dateString).isValid();
};

/**
 * Converts various date formats to ISO string for consistency
 * @param dateInput - The date input (string, Date object, etc.)
 * @returns The ISO string or null if invalid
 */
export const toISOString = (dateInput: any): string | null => {
  if (!dateInput) return null;
  
  try {
    const date = dayjs(dateInput);
    return date.isValid() ? date.toISOString() : null;
  } catch (error) {
    console.error('Error converting date to ISO string:', error);
    return null;
  }
};

/**
 * Compares two entries by their effective dates
 * @param entryA - First entry
 * @param entryB - Second entry
 * @returns -1 if entryA comes before entryB, 1 if after, 0 if same
 */
export const compareEntriesByDate = (entryA: any, entryB: any): number => {
  const dateA = getEffectiveEntryDate(entryA);
  const dateB = getEffectiveEntryDate(entryB);
  
  if (!dateA && !dateB) return 0;
  if (!dateA) return 1;
  if (!dateB) return -1;
  
  return dayjs(dateB).valueOf() - dayjs(dateA).valueOf(); // Descending order
};

/**
 * Formats a date for datetime-local input field (YYYY-MM-DDTHH:mm)
 * @param entry - The entry object
 * @returns The formatted date string for datetime-local input
 */
export const formatDateTimeForInput = (entry: any): string => {
  const effectiveDate = getEffectiveEntryDate(entry);
  if (!effectiveDate) return '';
  return dayjs(effectiveDate).format('YYYY-MM-DDTHH:mm');
};

/**
 * Converts datetime-local input string to ISO string for API
 * @param dateTimeLocalString - The datetime-local string (YYYY-MM-DDTHH:mm)
 * @returns The ISO string for API
 */
export const convertDateTimeLocalToISO = (dateTimeLocalString: string): string => {
  if (!dateTimeLocalString) return new Date().toISOString();
  return dayjs(dateTimeLocalString).toISOString();
};
