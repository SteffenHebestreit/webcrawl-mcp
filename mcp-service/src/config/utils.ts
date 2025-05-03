/**
 * Get a string environment variable with fallback
 * @param name Environment variable name
 * @param defaultValue Default value if not found
 * @returns The environment variable value or default
 */
export function getStringEnv(name: string, defaultValue: string): string {
  return process.env[name] || defaultValue;
}

/**
 * Get a number environment variable with fallback
 * @param name Environment variable name
 * @param defaultValue Default value if not found
 * @returns The environment variable as number or default
 */
export function getNumberEnv(name: string, defaultValue: number): number {
  const value = process.env[name];
  if (value === undefined) {
    return defaultValue;
  }
  const num = Number(value);
  return isNaN(num) ? defaultValue : num;
}

/**
 * Get a boolean environment variable with fallback
 * @param name Environment variable name
 * @param defaultValue Default value if not found
 * @returns The environment variable as boolean or default
 */
export function getBooleanEnv(name: string, defaultValue: boolean): boolean {
  const value = process.env[name]?.toLowerCase();
  if (value === undefined) {
    return defaultValue;
  }
  return value === 'true' || value === '1' || value === 'yes';
}

/**
 * Get an array environment variable with fallback
 * @param name Environment variable name
 * @param defaultValue Default value if not found
 * @returns The environment variable as string array or default
 */
export function getArrayEnv(name: string, defaultValue: string[]): string[] {
  const value = process.env[name];
  if (!value) {
    return defaultValue;
  }
  return value.split(',').map(item => item.trim());
}