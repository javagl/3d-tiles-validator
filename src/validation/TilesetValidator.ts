import { defined } from "../base/defined";

import { Validator } from "./Validator";
import { ValidationState } from "./ValidationState";
import { BasicValidator } from "./BasicValidator";
import { ValidationContext } from "./ValidationContext";
import { PropertiesValidator } from "./PropertiesValidator";
import { StatisticsValidator } from "./StatisticsValidator";
import { MetadataEntityValidator } from "./MetadataEntityValidator";
import { AssetValidator } from "./AssetValidator";
import { SchemaValidator } from "./SchemaValidator";
import { TilesetTraversingValidator } from "./TilesetTraversingValidator";

import { Tileset } from "../structure/Tileset";
import { Schema } from "../structure/Metadata/Schema";
import { Group } from "../structure/Group";

import { IoValidationIssues } from "../issues/IoValidationIssue";
import { StructureValidationIssues } from "../issues/StructureValidationIssues";
import { JsonValidationIssues } from "../issues/JsonValidationIssues";
import { RootPropertyValidator } from "./RootPropertyValidator";
import { SemanticValidationIssues } from "../issues/SemanticValidationIssues";

/**
 * A class that can validate a 3D Tiles tileset.
 */
export class TilesetValidator implements Validator<Tileset> {
  /**
   * Preliminary:
   *
   * An optional validator that will be applied to the `Tileset`
   * object, after it has been parsed from the JSON, but before
   * any further validation takes place.
   */
  private _genericValidator: Validator<any> | undefined;

  /**
   * Creates a new instance.
   *
   * Preliminary:
   *
   * The given validator will be applied to the `Tileset`
   * object, after it has been parsed from the JSON, but before
   * any further validation takes place.
   *
   * @param genericValidator The optional generic validator
   */
  constructor(genericValidator: Validator<any> | undefined) {
    this._genericValidator = genericValidator;
  }

  /**
   * Performs the validation of the tileset that is parsed from the
   * given input string.
   *
   * @param input The string that was read from a `tileset.json` file
   * @param context The `ValidationContext`
   * @returns A promise that resolves when the validation is finished
   */
  async validateJsonString(
    input: string,
    context: ValidationContext
  ): Promise<void> {
    try {
      const object: Tileset = JSON.parse(input);
      await this.validateObject(object, context);
    } catch (error) {
      //console.log(error);
      const issue = IoValidationIssues.JSON_PARSE_ERROR("", "" + error);
      context.addIssue(issue);
    }
  }

  /**
   * Internal method that performs the ajv-based JSON schema validation, and
   * then passes the input to `validateTileset`.
   *
   * TODO The ajv-based JSON schema validator will be removed
   *
   * @param input The `Tileset` object
   * @param context The `ValidationContext`
   * @returns A promise that resolves when the validation is finished
   * and indicates whether the object was valid or not.
   */
  async validateObject(
    input: Tileset,
    context: ValidationContext
  ): Promise<boolean> {
    let result = true;
    if (defined(this._genericValidator)) {
      const genericResult = this._genericValidator!.validateObject(
        input,
        context
      );
      if (!genericResult) {
        result = false;
      }
    }
    const tilesetResult = await TilesetValidator.validateTileset(
      input,
      context
    );
    if (!tilesetResult) {
      result = false;
    }
    return result;
  }

  /**
   * Performs the validation of the given `Tileset` object that was parsed
   * from a `tileset.json` input.
   *
   * Issues that are encountered during the validation will be added
   * as `ValidationIssue` instances to the given `ValidationContext`.
   *
   * @param tileset The `Tileset` object
   * @param context The `ValidationContext`
   * @returns A promise that resolves when the validation is finished
   * and indicates whether the object was valid or not.
   */
  static async validateTileset(
    tileset: Tileset,
    context: ValidationContext
  ): Promise<boolean> {
    const path = "";

    // Make sure that the given value is an object
    if (!BasicValidator.validateObject(path, "tileset", tileset, context)) {
      return false;
    }

    let result = true;

    // Validate the object as a RootProperty
    if (
      !RootPropertyValidator.validateRootProperty(
        path,
        "tileset",
        tileset,
        context
      )
    ) {
      result = false;
    }

    // The asset MUST be defined
    const asset = tileset.asset;
    if (!AssetValidator.validateAsset(asset, context)) {
      result = false;
    }

    // Validate the properties (I mean, the `properties`...)
    const properties = tileset.properties;
    if (defined(properties)) {
      if (!PropertiesValidator.validateProperties(properties!, context)) {
        result = false;
      }
    }

    // The schema and schemaUri MUST NOT be present at the same time
    if (defined(tileset.schema) && defined(tileset.schemaUri)) {
      const issue = JsonValidationIssues.ONE_OF_ERROR(
        path,
        "tileset",
        "schema",
        "schemaUri"
      );
      context.addIssue(issue);
      result = false;
    }

    // Validate the schemaUri
    const schemaUri = tileset.schemaUri;
    const schemaUriPath = path + "/schemaUri";
    if (defined(schemaUri)) {
      // The schemaUri MUST be a string
      if (
        !BasicValidator.validateString(
          schemaUriPath,
          "schemaUri",
          schemaUri,
          context
        )
      ) {
        result = false;
      }
    }

    // Create the ValidationState, and fill it with information
    // about the presence of a schema, and the validated schema
    // (if the schema is valid)
    const validationState: ValidationState = {
      validatedSchema: undefined,
      hasSchemaDefinition: false,
      validatedGroups: undefined,
      hasGroupsDefinition: false,
    };
    const schemaResult = await TilesetValidator.resolveTilesetSchema(
      tileset,
      context
    );
    validationState.hasSchemaDefinition = schemaResult.hasSchemaDefinition;

    // Validate the schema
    const schema = schemaResult.schema;
    const schemaPath = path + "/schema";
    if (defined(schema)) {
      if (SchemaValidator.validateSchema(schemaPath, schema!, context)) {
        validationState.validatedSchema = schema;
      } else {
        result = false;
      }
    }

    // Validate the groups.
    const groups = tileset.groups;
    const groupsPath = path + "/groups";
    if (defined(groups)) {
      validationState.hasGroupsDefinition = true;

      // If there are groups, then there must be a schema definition
      if (!validationState.hasSchemaDefinition) {
        const message =
          "The tileset defines 'groups' but does not have a schema";
        const issue = StructureValidationIssues.REQUIRED_VALUE_NOT_FOUND(
          groupsPath,
          message
        );
        context.addIssue(issue);
      } else if (defined(validationState.validatedSchema)) {
        if (
          TilesetValidator.validateTilesetGroups(
            groups!,
            validationState.validatedSchema!,
            context
          )
        ) {
          validationState.validatedGroups = groups;
        } else {
          result = false;
        }
      }
    }

    // Validate the statistics
    const statistics = tileset.statistics;
    const statisticsPath = path + "/statistics";
    if (defined(statistics)) {
      if (
        !StatisticsValidator.validateStatistics(
          statisticsPath,
          statistics!,
          validationState,
          context
        )
      ) {
        result = false;
      }
    }

    // Validate the geometricError
    const geometricError = tileset.geometricError;
    const geometricErrorPath = "/geometricError";

    // The geometricError MUST be defined
    // The geometricError MUST be a number
    // The geometricError MUST be >= 0
    if (
      !BasicValidator.validateNumberRange(
        geometricErrorPath,
        "geometricError",
        geometricError,
        0.0,
        true,
        undefined,
        false,
        context
      )
    ) {
      result = false;
    }

    // Validate the metadata
    const metadata = tileset.metadata;
    const metadataPath = path + "/metadata";
    if (defined(metadata)) {
      if (!validationState.hasSchemaDefinition) {
        // If there is metadata, then there MUST be a schema definition
        const message =
          `The tileset defines metadata, but ` +
          `there was no schema definition`;
        const issue = StructureValidationIssues.REQUIRED_VALUE_NOT_FOUND(
          path,
          message
        );
        context.addIssue(issue);
      } else if (defined(validationState.validatedSchema)) {
        if (
          !MetadataEntityValidator.validateMetadataEntity(
            metadataPath,
            "metadata",
            metadata!,
            validationState.validatedSchema!,
            context
          )
        ) {
          result = false;
        }
      }
    }

    const traversalValid = await TilesetTraversingValidator.validateTileset(
      tileset,
      validationState,
      context
    );
    if (!traversalValid) {
      result = false;
    }

    if (
      !TilesetValidator.validateExtensionDeclarations(path, tileset, context)
    ) {
      result = false;
    }

    return result;
  }

  /**
   * Validate the extension declarations of the given tileset.
   *
   * This is supposed to be called at the end of the validation process
   * of the tileset. It uses the extension names that have been added
   * to the `ValidationContext` via `addExtensionFound`, to make sure
   * that all extensions that are found have also been declared in
   * the 'extensionsUsed' array.
   *
   * It also performs the JSON-schema level validation of the basic
   * structure and consistency of the 'extensionsUsed' and
   * 'extensionsRequired' arrays of the given tileset.
   *
   * @param path The path for `ValidationIssue` instances
   * @param tileset The `Tileset`
   * @param context The `ValidationContext`
   * @returns Whether the declarations have been valid
   */
  private static validateExtensionDeclarations(
    path: string,
    tileset: Tileset,
    context: ValidationContext
  ): boolean {
    let result = true;

    // These are the actual sets of unique string values that
    // are found in 'extensionsUsed' and 'extensionsRequired'
    const actualExtensionsUsed = new Set<string>();
    const actualExtensionsRequired = new Set<string>();

    // Validate the extensionsUsed
    const extensionsUsed = tileset.extensionsUsed;
    const extensionsUsedPath = path + "/extensionsUsed";
    if (defined(extensionsUsed)) {
      // The extensionsUsed MUST be an array of strings with
      // a length of at least 1
      if (
        !BasicValidator.validateArray(
          extensionsUsedPath,
          "extensionsUsed",
          extensionsUsed,
          1,
          undefined,
          "string",
          context
        )
      ) {
        result = false;
      } else {
        extensionsUsed!.forEach((e) => actualExtensionsUsed.add(e));

        // The elements in extensionsUsed MUST be unique
        BasicValidator.validateArrayElementsUnique(
          extensionsUsedPath,
          "extensionsUsed",
          extensionsUsed,
          context
        );
      }
    }
    // Validate the extensionsRequired
    const extensionsRequired = tileset.extensionsRequired;
    const extensionsRequiredPath = path + "/extensionsRequired";
    if (defined(extensionsRequired)) {
      // The extensionsRequired MUST be an array of strings with
      // a length of at least 1
      if (
        !BasicValidator.validateArray(
          extensionsRequiredPath,
          "extensionsRequired",
          extensionsRequired,
          1,
          undefined,
          "string",
          context
        )
      ) {
        result = false;
      } else {
        extensionsRequired!.forEach((e) => actualExtensionsRequired.add(e));

        // The elements in extensionsRequired MUST be unique
        BasicValidator.validateArrayElementsUnique(
          extensionsRequiredPath,
          "extensionsRequired",
          extensionsRequired,
          context
        );
      }
    }

    // Each extension in extensionsRequired MUST also
    // appear in extensionsUsed.
    for (const extensionName of actualExtensionsRequired) {
      if (!actualExtensionsUsed.has(extensionName)) {
        const issue = SemanticValidationIssues.EXTENSION_REQUIRED_BUT_NOT_USED(
          extensionsRequiredPath,
          extensionName
        );
        context.addIssue(issue);
        result = false;
      }
    }

    // Each extension that is found during the validation
    // in the `RootPropertyValidator` also has to appear
    // in the 'extensionsUsed'
    const actualExtensionsFound = context.getExtensionsFound();
    for (const extensionName of actualExtensionsFound) {
      if (!actualExtensionsUsed.has(extensionName)) {
        const issue = SemanticValidationIssues.EXTENSION_FOUND_BUT_NOT_USED(
          extensionsRequiredPath,
          extensionName
        );
        context.addIssue(issue);
        result = false;
      }
    }

    // Each extension that is declared in the 'extensionsUsed'
    // should also appear in the extensions that are found
    // (but it does not have to - so this is just a warning)
    for (const extensionName of actualExtensionsUsed) {
      if (!actualExtensionsFound.has(extensionName)) {
        const issue = SemanticValidationIssues.EXTENSION_USED_BUT_NOT_FOUND(
          extensionsRequiredPath,
          extensionName
        );
        context.addIssue(issue);
      }
    }
    return result;
  }

  /**
   * Resolves the schema for the given tileset.
   *
   * The result will be an object with the following properties:
   *
   * `hasSchemaDefinition`: This is `true` if there either was a
   * `tileset.schema` or a `tileset.schemaUri`
   *
   * `schema`: This is either the `tileset.schema`, or the
   * schema that was read from the `tileset.schemaUri`. If
   * the latter could not be resolved, `schema` will be
   * `undefined`.
   *
   * @param tileset The `Tileset` object
   * @param context The `ValidationContext`
   * @returns A promise that resolves with the result object
   */
  static async resolveTilesetSchema(
    tileset: Tileset,
    context: ValidationContext
  ): Promise<{ hasSchemaDefinition: boolean; schema?: Schema }> {
    const schema = tileset.schema;
    const schemaUri = tileset.schemaUri;
    if (defined(schema) && typeof schema === "object") {
      return {
        hasSchemaDefinition: true,
        schema: schema,
      };
    }
    if (defined(schemaUri) && typeof schemaUri === "string") {
      const resourceResolver = context.getResourceResolver();
      const schemaBuffer = await resourceResolver.resolve(schemaUri);
      if (!defined(schemaBuffer)) {
        const path = "/schemaUri";
        const message = `The 'schemaUri' is '${schemaUri}' and could not be resolved`;
        const issue = IoValidationIssues.IO_ERROR(path, message);
        context.addIssue(issue);
        return {
          hasSchemaDefinition: true,
          schema: undefined,
        };
      } else {
        const schemaString = schemaBuffer!.toString();
        try {
          const resolvedSchema = JSON.parse(schemaString);
          return {
            hasSchemaDefinition: true,
            schema: resolvedSchema,
          };
        } catch (error) {
          //console.log(error);
          const issue = IoValidationIssues.JSON_PARSE_ERROR("", "" + error);
          context.addIssue(issue);
          return {
            hasSchemaDefinition: true,
            schema: undefined,
          };
        }
      }
    }
    return {
      hasSchemaDefinition: false,
      schema: undefined,
    };
  }

  /**
   * Validates the given `tileset.groups`
   *
   * @param groups The groups
   * @param schema The schema that was either contained in the
   * `tileset.schema`, or resolved from the `tileset.schemaUri`
   * @param context The `ValidationContext`
   * @returns Whether the groups are valid
   */
  private static validateTilesetGroups(
    groups: Group[],
    schema: Schema,
    context: ValidationContext
  ): boolean {
    const groupsPath = "/groups";

    // The groups MUST be an array of objects
    if (
      !BasicValidator.validateArray(
        groupsPath,
        "groups",
        groups,
        undefined,
        undefined,
        "object",
        context
      )
    ) {
      return false;
    }
    // Validate each group against the schema
    let allValid = true;
    for (let index = 0; index < groups.length; index++) {
      const group = groups[index];
      const groupPath = groupsPath + "/" + index;
      allValid =
        allValid &&
        MetadataEntityValidator.validateMetadataEntity(
          groupPath,
          "group[" + index + "]",
          group,
          schema,
          context
        );
    }
    return allValid;
  }
}
