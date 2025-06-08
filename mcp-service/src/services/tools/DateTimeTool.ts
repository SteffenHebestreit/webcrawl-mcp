import { DateTimeParams, DateTimeResponse } from '../../types/mcp';
import { createLogger } from '../../utils/logger';
import { format, getWeek, getDayOfYear, getQuarter } from 'date-fns';
import { formatInTimeZone, toZonedTime } from 'date-fns-tz';
import { BaseTool } from './BaseTool';

export class DateTimeTool extends BaseTool<DateTimeParams, DateTimeResponse> {
  constructor() {
    super('DateTimeTool');
  }

  public async execute(params: DateTimeParams): Promise<DateTimeResponse> {
    this.logger.info('Executing dateTime with params:', params);
    
    try {
      // Set default values
      const city = params.city || 'Berlin';
      const formatOutput = params.format || 'both'; // Renamed to avoid conflict with imported format function
      const includeTimezone = params.includeTimezone !== undefined ? params.includeTimezone : true;
      
      // Simple city-to-timezone mapping
      const cityTimezoneMap: Record<string, string> = {
        'berlin': 'Europe/Berlin',
        'london': 'Europe/London',
        'paris': 'Europe/Paris',
        'rome': 'Europe/Rome',
        'madrid': 'Europe/Madrid',
        'amsterdam': 'Europe/Amsterdam',
        'vienna': 'Europe/Vienna',
        'zurich': 'Europe/Zurich',
        'new york': 'America/New_York',
        'los angeles': 'America/Los_Angeles',
        'chicago': 'America/Chicago',
        'toronto': 'America/Toronto',
        'vancouver': 'America/Vancouver',
        'tokyo': 'Asia/Tokyo',
        'seoul': 'Asia/Seoul',
        'beijing': 'Asia/Shanghai',
        'shanghai': 'Asia/Shanghai',
        'hong kong': 'Asia/Hong_Kong',
        'singapore': 'Asia/Singapore',
        'mumbai': 'Asia/Kolkata',
        'delhi': 'Asia/Kolkata',
        'sydney': 'Australia/Sydney',
        'melbourne': 'Australia/Melbourne',
        'auckland': 'Pacific/Auckland',
        'moscow': 'Europe/Moscow',
        'istanbul': 'Europe/Istanbul',
        'dubai': 'Asia/Dubai',
        'cairo': 'Africa/Cairo',
        'johannesburg': 'Africa/Johannesburg',
        'sao paulo': 'America/Sao_Paulo',
        'buenos aires': 'America/Argentina/Buenos_Aires',
        'mexico city': 'America/Mexico_City'
      };
      
      // Get timezone for the city (case-insensitive lookup)
      const timezone = cityTimezoneMap[city.toLowerCase()] || 'Europe/Berlin';
      
      // Get current time
      const now = new Date();
      
      // Format times
      const utcTime = now.toISOString();
      const zonedTime = toZonedTime(now, timezone);
      const isoTime = formatInTimeZone(now, timezone, "yyyy-MM-dd'T'HH:mm:ss.SSSXXX");
      const humanTime = formatInTimeZone(now, timezone, 'EEEE, MMMM d, yyyy \'at\' h:mm a');
      
      // Calculate additional info
      const dayOfWeek = formatInTimeZone(now, timezone, 'EEEE');
      const dayOfYear = getDayOfYear(zonedTime);
      const weekOfYear = getWeek(zonedTime);
      const quarter = getQuarter(zonedTime);
      
      // Calculate timezone offset
      const offsetMs = zonedTime.getTimezoneOffset() * 60000 * -1; // Corrected offset calculation
      const offsetHours = Math.floor(Math.abs(offsetMs) / 3600000);
      const offsetMinutes = Math.floor((Math.abs(offsetMs) % 3600000) / 60000);
      const offsetSign = offsetMs >= 0 ? '+' : '-';
      const timezoneOffset = `${offsetSign}${offsetHours.toString().padStart(2, '0')}:${offsetMinutes.toString().padStart(2, '0')}`;
        // Determine if daylight saving is active (basic approximation)
      const winterDate = new Date(now.getFullYear(), 0, 1);
      const summerDate = new Date(now.getFullYear(), 6, 1);
      const winterOffset = toZonedTime(winterDate, timezone).getTimezoneOffset();
      const summerOffset = toZonedTime(summerDate, timezone).getTimezoneOffset();
      const isDaylightSaving = zonedTime.getTimezoneOffset() !== Math.max(winterOffset, summerOffset);
      
      const response: DateTimeResponse = {
        success: true,
        city,
        timezone: timezone,
        currentDateTime: {
          iso: isoTime,
          human: humanTime,
          utc: utcTime
        },
        additionalInfo: {
          dayOfWeek,
          dayOfYear,
          weekOfYear,
          quarter,
          isDaylightSaving: includeTimezone ? isDaylightSaving : false,
          timezoneOffset: timezoneOffset
        }
      };

      return response;
      
    } catch (error: any) {
      this.logger.error('Error in DateTimeTool executeDateTime:', error);
      return {
        success: false,
        city: params.city || 'Berlin',
        timezone: 'Europe/Berlin',
        currentDateTime: { 
          iso: new Date().toISOString(),
          human: new Date().toLocaleString(),
          utc: new Date().toISOString()
        },
        additionalInfo: { 
          dayOfWeek: '', 
          dayOfYear: 0, 
          weekOfYear: 0, 
          quarter: 0,
          timezoneOffset: '+00:00'
        },
        error: error.message
      };
    }
  }
}
