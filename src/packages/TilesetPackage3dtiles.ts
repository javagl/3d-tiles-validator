import { defined } from "./base/defined";

import { Database } from "better-sqlite3";
import DatabaseConstructor from "better-sqlite3";

import { TilesetPackage } from "./TilesetPackage";
import { TilesetPackageError } from "./TilesetPackageError";
import { Iterables } from "./base/Iterables";

/**
 * Implementation of a TilesetPackage based on a 3DTILES (SQLITE3 database)
 * file.
 */
export class TilesetPackage3dtiles implements TilesetPackage {
  /**
   * The database, or undefined if the database is not opened
   */
  private db: Database | undefined;

  /**
   * Default constructor
   */
  constructor() {
    this.db = undefined;
  }

  open(fullInputName: string): void {
    if (defined(this.db)) {
      throw new TilesetPackageError("Database already opened");
    }
    this.db = new DatabaseConstructor(fullInputName);

    const message = TilesetPackage3dtiles.validateTableStructure(this.db!);
    if (defined(message)) {
      this.close();
      throw new TilesetPackageError(message!);
    }
  }

  /**
   * Validates that the structure of the given database matches
   * the requirements of a 3D Tiles database:
   *
   * There must be a table called 'media'.
   * The table must have 2 columns.
   * The name of column 0 must be 'key'
   * The type of column 0 must be 'TEXT'
   * The name of column 1 must be 'content'
   * The type of column 1 must be 'BLOB'
   *
   * @param db - The database
   * @returns An error message, or `undefined` if the structure is valid
   */
  private static validateTableStructure(db: Database): string | undefined {
    let selection;
    try {
      selection = db.prepare("SELECT * FROM media LIMIT 1");
    } catch (e) {
      return `${e}`;
    }
    const columns = selection.columns();
    if (columns.length !== 2) {
      return `Expected 2 columns, but found ${columns.length}`;
    }
    if (columns[0].name !== "key") {
      return `Column 0 name must be 'key', but is ${columns[0].name}`;
    }
    if (columns[0].type !== "TEXT") {
      return `Column 0 type must be 'TEXT', but is ${columns[0].type}`;
    }
    if (columns[1].name !== "content") {
      return `Column 1 name must be 'content', but is ${columns[1].name}`;
    }
    if (columns[1].type !== "BLOB") {
      return `Column 1 type must be 'BLOB', but is ${columns[1].type}`;
    }
    return undefined;
  }

  getKeys(): IterableIterator<string> {
    if (!defined(this.db)) {
      throw new TilesetPackageError(
        "Package is not opened. Call 'open' first."
      );
    }
    const selection = this.db!.prepare("SELECT * FROM media");
    const iterator = selection.iterate();
    return Iterables.map(iterator, (row: any) => row.key);
  }

  getEntry(key: string): Buffer | undefined {
    if (!defined(this.db)) {
      throw new Error("Package is not opened. Call 'open' first.");
    }
    const selection = this.db!.prepare("SELECT * FROM media WHERE key = ?");
    const row = selection.get(key) as any;
    if (defined(row)) {
      return row.content;
    }
    return undefined;
  }

  close() {
    if (!defined(this.db)) {
      throw new Error("Package is not opened. Call 'open' first.");
    }
    this.db!.close();
    this.db = undefined;
  }
}
