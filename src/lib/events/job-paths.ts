/**
 * Screens that show a job, and so need the live/recorded controls and the live coordinator stream. Every other page
 * (the product site, legal pages, settings) makes no job or provider calls (ekido-ai/ekido-internal#93).
 */
// "/jobs/new", not "/jobs": a customer's job page (/jobs/[id]) reads the Platform API, not the live stream (web #39).
export const JOB_PATHS = ["/dashboard", "/recovery", "/quality", "/settlement", "/verify", "/earnings", "/replay", "/jobs/new"];

export const showsJob = (path: string) => JOB_PATHS.some((p) => path.startsWith(p));
