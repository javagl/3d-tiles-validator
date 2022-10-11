//eslint-disable-next-line
const yargs = require("yargs/yargs");

import { ValidatorMain } from "./ValidatorMain";

ValidatorMain.registerExtensionValidators();

const args = yargs(process.argv.slice(1))
  .help("help")
  .alias("help", "h")
  .options({
    tilesetFile: {
      type: "string",
      alias: "t",
      describe: "The tileset input file path",
    },
    tilesetsDirectory: {
      type: "string",
      alias: "T",
      describe:
        "The tileset input directory. This will validate all files " +
        "in the given directory and its subdirectories that match " +
        "the tilesetGlobPattern",
    },
    tilesetGlobPattern: {
      type: "string",
      alias: "g",
      default: "**/*tileset*.json",
      describe:
        "The glob pattern for matching tileset input files from directories",
    },
    metadataSchemaFile: {
      type: "string",
      alias: "m",
      describe: "The metadata schema input file path",
    },
    subtreeFile: {
      type: "string",
      alias: "s",
      describe: "The subtree input file path",
    },
    tilesetSpecs: {
      type: "boolean",
      describe: "Validate all tileset spec files",
    },
    metadataSchemaSpecs: {
      type: "boolean",
      describe: "Validate all metadata schema spec files",
    },
    subtreeSpecs: {
      type: "boolean",
      describe: "Validate all subtree spec files",
    },
    reportFile: {
      type: "string",
      describe:
        "The name of the file where the report of a single " +
        "validated input file should be written",
    },
    writeReports: {
      type: "boolean",
      describe:
        "Write one report file for each validated file. The file name " +
        "of the report will be derived from the input file name, " +
        "and be written into the same directory as the input file.",
    },
  })
  .demandCommand();
const argv = args.argv;

/**
 * If a `reportFile` was specified in the command line arguments,
 * then this is returned.
 *
 * Otherwise, if `writeReports` was specified, a report file
 * name is derived from the given file name and returned
 * (with the details about this name being unspecified for now).
 *
 * Otherwise, `undefined` is returned.
 *
 * @param inputFileName The input file name
 * @returns The report file name, or `undefined`
 */
function obtainReportFileName(inputFileName: string): string | undefined {
  if (argv.reportFile) {
    return argv.reportFile;
  }
  if (argv.writeReports) {
    return ValidatorMain.deriveReportFileName(inputFileName);
  }
  return undefined;
}

if (argv.tilesetFile) {
  const reportFileName = obtainReportFileName(argv.tilesetFile);
  ValidatorMain.validateTilesetFile(argv.tilesetFile, reportFileName);
} else if (argv.tilesetsDirectory) {
  ValidatorMain.validateTilesetsDirectory(
    argv.tilesetsDirectory,
    argv.tilesetGlobPattern,
    argv.writeReports
  );
} else if (argv.metadataSchemaFile) {
  const reportFileName = obtainReportFileName(argv.metadataSchemaFile);
  ValidatorMain.validateSchemaFile(argv.metadataSchemaFile, reportFileName);
} else if (argv.subtreeFile) {
  const reportFileName = obtainReportFileName(argv.subtreeFile);
  ValidatorMain.validateSubtreeSpecFile(argv.subtreeFile, reportFileName);
} else if (argv.tilesetSpecs) {
  ValidatorMain.validateAllTilesetSpecFiles(argv.writeReports);
} else if (argv.metadataSchemaSpecs) {
  ValidatorMain.validateAllMetadataSchemaSpecFiles(argv.writeReports);
} else if (argv.subtreeSpecs) {
  ValidatorMain.validateAllSubtreeSpecFiles(argv.writeReports);
} else {
  args.showHelp();
}
