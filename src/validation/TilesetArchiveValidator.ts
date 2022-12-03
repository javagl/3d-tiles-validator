import { defined } from "../base/defined";

import { Validators } from "./Validators";
import { Validator } from "./Validator";
import { ValidationContext } from "./ValidationContext";

import { ArchiveResourceResolver } from "../io/ArchiveResourceResolver";

import { ContentValidationIssues } from "../issues/ContentValidationIssues";
import { IoValidationIssues } from "../issues/IoValidationIssue";

import { TilesetArchive3tz } from "../archives/TilesetArchive3tz";
import { ArchiveValidation3tz } from "../archives/ArchiveValidation3tz";

/**
 * An implementation of a validator that validates a tileset
 * archive.
 *
 * The 'archive' here is represented as a `string`, assuming that
 * this string is a file in the local file system.
 */
export class TilesetArchiveValidator implements Validator<string> {
  async validateObject(
    uri: string,
    resolvedUri: string,
    context: ValidationContext
  ): Promise<boolean> {
    //console.log("TilesetArchiveValidator resolvedUri is " + resolvedUri);

    // Create the archive from the given resolved URI (i.e.
    // the full archive file name). If the archive cannot
    // be opened, bail out with an IO_WARNING.
    let archive = undefined;
    try {
      archive = new TilesetArchive3tz();
      archive.open(resolvedUri);
    } catch (error) {
      const message =
        `Could not create archive from ${uri}. ` +
        `Full archive URI is ${resolvedUri}.`;
      const issue = IoValidationIssues.IO_WARNING(uri, message);
      context.addIssue(issue);
      return true;
    }

    // Obtain the ZIP index from the archive, to be able to apply
    // the ("legacy") 3TZ archive validation to the ZIP index
    const zipIndex = archive.getZipIndex();
    if (defined(zipIndex)) {
      try {
        const indexValid = await ArchiveValidation3tz.validateIndex(
          zipIndex!,
          resolvedUri,
          false
        );
        if (!indexValid) {
          const message = `The 3TZ index is not valid`;
          const issue = ContentValidationIssues.CONTENT_VALIDATION_ERROR(
            resolvedUri,
            message
          );
          context.addIssue(issue);
          return false;
        }
      } catch (error) {
        const message = `Error while validating 3TZ index: ${error}.`;
        const issue = ContentValidationIssues.CONTENT_VALIDATION_ERROR(
          resolvedUri,
          message
        );
        context.addIssue(issue);
        return false;
      }
    }

    // Create the `ArchiveResourceResolver` from the archive,
    // and obtain the data for the `tileset.json` file.
    // This has to be present according to the 3TZ specification.
    const archiveResourceResolver = new ArchiveResourceResolver(
      "./",
      resolvedUri,
      archive
    );
    const tilesetJsonBuffer = await archiveResourceResolver.resolveData(
      "tileset.json"
    );
    if (!defined(tilesetJsonBuffer)) {
      const message =
        `Could not read 'tileset.json' from archive ${uri}.` +
        `Full archive URI is ${resolvedUri}.`;
      const issue = IoValidationIssues.IO_ERROR(uri, message);
      context.addIssue(issue);
      return false;
    }

    // Parse the tileset object from the JSON data
    let tileset = undefined;
    try {
      tileset = JSON.parse(tilesetJsonBuffer!.toString());
    } catch (error) {
      const message =
        `Could not parse tileset JSON from 'tileset.json' ` +
        `data in archive ${uri}. Full archive URI is ${resolvedUri}.`;
      const issue = IoValidationIssues.IO_ERROR(uri, message);
      context.addIssue(issue);
      return false;
    }

    // Open a new context for collecting the issues that
    // are caused by the tileset, and validate the
    // tileset using a default tileset validator.
    const derivedContext = context.deriveFromResourceResolver(
      archiveResourceResolver
    );
    const tilesetValidator = Validators.createDefaultTilesetValidator();
    const result = await tilesetValidator.validateObject(
      uri + "/tileset.json",
      tileset,
      derivedContext
    );
    const derivedResult = derivedContext.getResult();
    const issue = ContentValidationIssues.createForContent(uri, derivedResult);
    if (issue) {
      context.addIssue(issue);
    }
    return result;
  }
}