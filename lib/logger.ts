// Centralized logger — silent in production
/* eslint-disable @typescript-eslint/no-explicit-any */

const isDev = process.env.NODE_ENV === 'development';

export const log = isDev ? console.log.bind(console) : (..._args: any[]) => {};
export const warn = isDev ? console.warn.bind(console) : (..._args: any[]) => {};
export const error = console.error.bind(console); // Always log errors
