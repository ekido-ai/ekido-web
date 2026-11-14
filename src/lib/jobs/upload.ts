/** Reading a signed job request from a file the person picks. The same 250 KB limit as the text box. */
export const MAX_JOB_FILE_BYTES = 250_000;

export interface JobFileLike {
  name: string;
  size: number;
  text(): Promise<string>;
}

export async function readJobFile(file: JobFileLike): Promise<string> {
  if (file.size === 0) throw new Error("The file is empty.");
  if (file.size > MAX_JOB_FILE_BYTES) throw new Error("The file is too large for a job request (the limit is 250 KB).");
  const contents = (await file.text()).replace(/^﻿/, "");
  if (contents.length > MAX_JOB_FILE_BYTES) throw new Error("The file is too large for a job request (the limit is 250 KB).");
  if (!contents.trim()) throw new Error("The file is empty.");
  return contents;
}
