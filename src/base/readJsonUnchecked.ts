import fs from "fs";

import { defined } from "../base/defined";

/**
 * Only for internal use and basic tests:
 *
 * Reads a JSON file, parses it, and returns the result.
 * If the file cannot be read or parsed, then an error
 * message will be printed and `undefined` is returned.
 *
 * @param filePath The path to the file
 * @returns A promise that resolves with the result or `undefined`
 */
export async function readJsonUnchecked(filePath: string): Promise<any> {
  const data = fs.readFileSync(filePath);
  if (!defined(data)) {
    console.error("Could not read " + filePath);
    return undefined;
  }
  const jsonString = data.toString();
  try {
    const result = JSON.parse(jsonString);
    return result;
  } catch (error) {
    console.error("Could not parse JSON", error);
    return undefined;
  }
}