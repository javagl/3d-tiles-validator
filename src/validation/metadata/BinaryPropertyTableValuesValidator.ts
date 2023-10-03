import { defined } from "3d-tiles-tools";
import { defaultValue } from "3d-tiles-tools";
import { ArrayValues } from "3d-tiles-tools";

import { BinaryPropertyTable } from "3d-tiles-tools";
import { BinaryPropertyTableModel } from "3d-tiles-tools";

import { ClassProperties } from "3d-tiles-tools";
import { ClassProperty } from "3d-tiles-tools";

import { BasicValidator } from "../BasicValidator";
import { ValidationContext } from "../ValidationContext";

import { MetadataValuesValidationMessages } from "./MetadataValueValidationMessages";

import { MetadataValidationIssues } from "../../issues/MetadataValidationIssues";

/**
 * A class for the validation of values that are stored
 * in binary property tables.
 *
 * The methods in this class assume that the structural
 * validity of the input objects has already been checked
 * by a `PropertyTableValidator` and a
 * `BinaryPropertyTableValidator`.
 *
 * @internal
 */
export class BinaryPropertyTableValuesValidator {
  /**
   * Performs the validation to ensure that the given
   * `BinaryPropertyTable` contains valid values.
   *
   * @param path - The path for the `ValidationIssue` instances
   * @param binaryPropertyTable - The object to validate
   * @param context - The `ValidationContext` that any issues will be added to
   * @returns Whether the values in the object have been valid
   */
  static validateBinaryPropertyTableValues(
    path: string,
    binaryPropertyTable: BinaryPropertyTable,
    context: ValidationContext
  ): boolean {
    let result = true;

    const binaryMetadata = binaryPropertyTable.binaryMetadata;
    const metadataClass = binaryMetadata.metadataClass;
    const classProperties = defaultValue(metadataClass.properties, {});

    for (const propertyId of Object.keys(classProperties)) {
      const classProperty = classProperties[propertyId];
      const propertyPath = path + "/properties/" + propertyId;
      if (
        !BinaryPropertyTableValuesValidator.validateBinaryPropertyTablePropertyValues(
          propertyPath,
          propertyId,
          classProperty,
          binaryPropertyTable,
          context
        )
      ) {
        result = false;
      }
    }
    return result;
  }

  /**
   * Validate the values of a single property of a `BinaryPropertyTable`
   *
   * @param path - The path of the `PropertyTablePropery`, for
   * `ValidationIssue` instances
   * @param propertyId - The property ID
   * @param classProperty - The `ClassProperty`
   * @param binaryPropertyTable - The `BinaryPropertyTable`
   * @param context - The `ValidationContext`
   * @returns Whether the property is valid
   */
  private static validateBinaryPropertyTablePropertyValues(
    path: string,
    propertyId: string,
    classProperty: ClassProperty,
    binaryPropertyTable: BinaryPropertyTable,
    context: ValidationContext
  ): boolean {
    let result = true;

    const propertyTable = binaryPropertyTable.propertyTable;
    const propertyTableProperties = defaultValue(propertyTable.properties, {});
    const propertyTablePropertry = propertyTableProperties[propertyId];

    // Perform the checks that only apply to ENUM types,
    if (classProperty.type === "ENUM") {
      if (
        !BinaryPropertyTableValuesValidator.validateEnumValues(
          path,
          propertyId,
          binaryPropertyTable,
          context
        )
      ) {
        result = false;
      }
    }

    // Perform the checks that only apply to numeric types
    if (ClassProperties.hasNumericType(classProperty)) {
      // When the ClassProperty defines a minimum, then the metadata
      // values MUST not be smaller than this minimum
      if (defined(classProperty.min)) {
        if (
          !BinaryPropertyTableValuesValidator.validateMin(
            path,
            propertyId,
            classProperty.min,
            "class property",
            binaryPropertyTable,
            context
          )
        ) {
          result = false;
        }
      }

      // When the PropertyTableProperty defines a minimum, then the metadata
      // values MUST not be smaller than this minimum
      if (defined(propertyTablePropertry.min)) {
        const definedMin = propertyTablePropertry.min;
        if (
          !BinaryPropertyTableValuesValidator.validateMin(
            path,
            propertyId,
            definedMin,
            "property table property",
            binaryPropertyTable,
            context
          )
        ) {
          result = false;
        } else {
          // When none of the values is smaller than the minimum from
          // the PropertyTableProperty, make sure that this minimum
          // matches the computed minimum of all metadata values
          const computedMin = BinaryPropertyTableValuesValidator.computeMin(
            propertyId,
            binaryPropertyTable
          );
          if (!ArrayValues.deepEquals(computedMin, definedMin)) {
            const message =
              `For property ${propertyId}, the property table property ` +
              `defines a minimum of ${definedMin}, but the computed ` +
              `minimum value is ${computedMin}`;
            const issue = MetadataValidationIssues.METADATA_VALUE_MISMATCH(
              path,
              message
            );
            context.addIssue(issue);
            result = false;
          }
        }
      }

      // When the ClassProperty defines a maximum, then the metadata
      // values MUST not be greater than this maximum
      if (defined(classProperty.max)) {
        if (
          !BinaryPropertyTableValuesValidator.validateMax(
            path,
            propertyId,
            classProperty.max,
            "class property",
            binaryPropertyTable,
            context
          )
        ) {
          result = false;
        }
      }

      // When the PropertyTableProperty defines a maximum, then the metadata
      // values MUST not be greater than this maximum
      if (defined(propertyTablePropertry.max)) {
        const definedMax = propertyTablePropertry.max;
        if (
          !BinaryPropertyTableValuesValidator.validateMax(
            path,
            propertyId,
            definedMax,
            "property table property",
            binaryPropertyTable,
            context
          )
        ) {
          result = false;
        } else {
          // When none of the values is greater than the maximum from
          // the PropertyTableProperty, make sure that this maximum
          // matches the computed maximum of all metadata values
          const computedMax = BinaryPropertyTableValuesValidator.computeMax(
            propertyId,
            binaryPropertyTable
          );
          if (!ArrayValues.deepEquals(computedMax, definedMax)) {
            const message =
              `For property ${propertyId}, the property table property ` +
              `defines a maximum of ${definedMax}, but the computed ` +
              `maximum value is ${computedMax}`;
            const issue = MetadataValidationIssues.METADATA_VALUE_MISMATCH(
              path,
              message
            );
            context.addIssue(issue);
            result = false;
          }
        }
      }
    }

    return result;
  }

  /**
   * Validate that the values of the specified ENUM property are valid.
   *
   * This applies to properties in the given binary property table
   * that have the ENUM type, both for arrays and non-arrays. It
   * will ensure that each value that appears as in the binary data
   * is a value that was actually defined as one of the
   * `enum.values[i].value` values in the schema definition.
   *
   * @param path - The path for `ValidationIssue` instances
   * @param propertyId - The property ID
   * @param binaryPropertyTable - The `BinaryPropertyTable`
   * @param context - The `ValidationContext`
   * @returns Whether the enum values have been valid
   */
  private static validateEnumValues(
    path: string,
    propertyId: string,
    binaryPropertyTable: BinaryPropertyTable,
    context: ValidationContext
  ): boolean {
    let result = true;

    const propertyTable = binaryPropertyTable.propertyTable;
    const propertyTableCount = propertyTable.count;
    const propertyTableModel = new BinaryPropertyTableModel(
      binaryPropertyTable
    );

    const binaryMetadata = binaryPropertyTable.binaryMetadata;
    const metadataClass = binaryMetadata.metadataClass;
    const classProperties = defaultValue(metadataClass.properties, {});
    const classProperty = classProperties[propertyId];

    const binaryEnumInfo = binaryMetadata.binaryEnumInfo;

    // Obtain the validEnumNameValues, which are all values that
    // appear as `enum.values[i].value` in the schema.
    const enumValueNameValues = binaryEnumInfo.enumValueNameValues;
    const nameValues = enumValueNameValues[classProperty.enumType!];
    const validEnumValueValues = Object.values(nameValues);

    const propertyModel = propertyTableModel.getPropertyModel(propertyId)!;

    // Validate each property value
    for (let index = 0; index < propertyTableCount; index++) {
      // The validation takes place based on the RAW (numeric)
      // values from the property model (and not on the string
      // valuses from the metadata entity model)
      const rawPropertyValue = propertyModel.getPropertyValue(index);

      // For arrays, simply validate each element individually
      if (Array.isArray(rawPropertyValue)) {
        for (let i = 0; i < rawPropertyValue.length; i++) {
          const rawPropertyValueElement = rawPropertyValue[i];
          const rawPropertyValueElementPath = `${path}/${i}`;
          if (
            !BasicValidator.validateEnum(
              rawPropertyValueElementPath,
              propertyId,
              rawPropertyValueElement,
              validEnumValueValues,
              context
            )
          ) {
            result = false;
          }
        }
      } else {
        if (
          !BasicValidator.validateEnum(
            path,
            propertyId,
            rawPropertyValue,
            validEnumValueValues,
            context
          )
        ) {
          result = false;
        }
      }
    }
    return result;
  }

  /**
   * Validate the that none of the values of the specified
   * property in the given property table is smaller than
   * the given defined minimum.
   *
   * @param path - The path of the `PropertyTablePropery`, for
   * `ValidationIssue` instances
   * @param propertyId - The property ID
   * @param definedMin - The defined minimum
   * @param definedMinInfo - A string indicating the source of the minimum
   * definition: 'class property' or 'property table property'.
   * @param binaryPropertyTable - The `BinaryPropertyTable`
   * @param context - The `ValidationContext`
   * @returns Whether the values obeyed the limit
   */
  private static validateMin(
    path: string,
    propertyId: string,
    definedMin: any,
    definedMinInfo: string,
    binaryPropertyTable: BinaryPropertyTable,
    context: ValidationContext
  ): boolean {
    let result = true;

    const propertyTable = binaryPropertyTable.propertyTable;
    const propertyTableCount = propertyTable.count;
    const propertyTableProperties = defaultValue(propertyTable.properties, {});
    const propertyTablePropertry = propertyTableProperties[propertyId];

    const binaryMetadata = binaryPropertyTable.binaryMetadata;
    const metadataClass = binaryMetadata.metadataClass;
    const classProperties = defaultValue(metadataClass.properties, {});
    const classProperty = classProperties[propertyId];

    const propertyTableModel = new BinaryPropertyTableModel(
      binaryPropertyTable
    );
    const propertyModel = propertyTableModel.getPropertyModel(propertyId);

    // Validate each property value
    for (let index = 0; index < propertyTableCount; index++) {
      const metadataEntityModel =
        propertyTableModel.getMetadataEntityModel(index);
      const propertyValue = metadataEntityModel.getPropertyValue(propertyId);
      const rawPropertyValue = propertyModel!.getPropertyValue(index);

      if (ArrayValues.anyDeepLessThan(propertyValue, definedMin)) {
        const valueMessagePart =
          MetadataValuesValidationMessages.createValueMessagePart(
            rawPropertyValue,
            classProperty.normalized,
            propertyTablePropertry.scale,
            propertyTablePropertry.offset,
            propertyValue
          );

        const message =
          `For property '${propertyId}', the ${definedMinInfo} ` +
          `defines a minimum of ${definedMin}, but the value in the property ` +
          `table at index ${index} is ${valueMessagePart}`;
        const issue = MetadataValidationIssues.METADATA_VALUE_NOT_IN_RANGE(
          path,
          message
        );
        context.addIssue(issue);
        result = false;
      }
    }
    return result;
  }

  /**
   * Compute the mimimum value for the specified property in
   * the given property table.
   *
   * This assumes that the property has a numeric type,
   * as indicated by `ClassProperties.hasNumericType`.
   *
   * @param propertyId - The property ID
   * @param binaryPropertyTable - The `BinaryPropertyTable`
   * @returns The minimum
   */
  private static computeMin(
    propertyId: string,
    binaryPropertyTable: BinaryPropertyTable
  ): any {
    const propertyTable = binaryPropertyTable.propertyTable;
    const propertyTableCount = propertyTable.count;
    const propertyTableModel = new BinaryPropertyTableModel(
      binaryPropertyTable
    );

    let computedMin = undefined;
    for (let index = 0; index < propertyTableCount; index++) {
      const metadataEntityModel =
        propertyTableModel.getMetadataEntityModel(index);
      const propertyValue = metadataEntityModel.getPropertyValue(propertyId);
      if (index === 0) {
        computedMin = ArrayValues.deepClone(propertyValue);
      } else {
        computedMin = ArrayValues.deepMin(computedMin, propertyValue);
      }
    }
    return computedMin;
  }

  /**
   * Validate the that none of the values of the specified
   * property in the given property table is smaller than
   * the given defined maximum.
   *
   * @param path - The path of the `PropertyTablePropery`, for
   * `ValidationIssue` instances
   * @param propertyId - The property ID
   * @param definedMax - The defined maximum
   * @param definedMaxInfo - A string indicating the source of the maximum
   * definition: 'class property' or 'property table property'.
   * @param binaryPropertyTable - The `BinaryPropertyTable`
   * @param context - The `ValidationContext`
   * @returns Whether the values obeyed the limit
   */
  private static validateMax(
    path: string,
    propertyId: string,
    definedMax: any,
    definedMaxInfo: string,
    binaryPropertyTable: BinaryPropertyTable,
    context: ValidationContext
  ): boolean {
    let result = true;

    const propertyTable = binaryPropertyTable.propertyTable;
    const propertyTableCount = propertyTable.count;
    const propertyTableProperties = defaultValue(propertyTable.properties, {});
    const propertyTablePropertry = propertyTableProperties[propertyId];

    const binaryMetadata = binaryPropertyTable.binaryMetadata;
    const metadataClass = binaryMetadata.metadataClass;
    const classProperties = defaultValue(metadataClass.properties, {});
    const classProperty = classProperties[propertyId];

    const propertyTableModel = new BinaryPropertyTableModel(
      binaryPropertyTable
    );
    const propertyModel = propertyTableModel.getPropertyModel(propertyId);

    // Validate each property value
    for (let index = 0; index < propertyTableCount; index++) {
      const metadataEntityModel =
        propertyTableModel.getMetadataEntityModel(index);
      const propertyValue = metadataEntityModel.getPropertyValue(propertyId);
      const rawPropertyValue = propertyModel!.getPropertyValue(index);

      if (ArrayValues.anyDeepGreaterThan(propertyValue, definedMax)) {
        const valueMessagePart =
          MetadataValuesValidationMessages.createValueMessagePart(
            rawPropertyValue,
            classProperty.normalized,
            propertyTablePropertry.scale,
            propertyTablePropertry.offset,
            propertyValue
          );

        const message =
          `For property '${propertyId}', the ${definedMaxInfo} ` +
          `defines a maximum of ${definedMax}, but the value in the property ` +
          `table at index ${index} is ${valueMessagePart}`;
        const issue = MetadataValidationIssues.METADATA_VALUE_NOT_IN_RANGE(
          path,
          message
        );
        context.addIssue(issue);
        result = false;
      }
    }
    return result;
  }

  /**
   * Compute the maximum value for the specified property in
   * the given property table.
   *
   * This assumes that the property has a numeric type,
   * as indicated by `ClassProperties.hasNumericType`.
   *
   * @param propertyId - The property ID
   * @param binaryPropertyTable - The `BinaryPropertyTable`
   * @returns The maximum
   */
  private static computeMax(
    propertyId: string,
    binaryPropertyTable: BinaryPropertyTable
  ): any {
    const propertyTable = binaryPropertyTable.propertyTable;
    const propertyTableCount = propertyTable.count;
    const propertyTableModel = new BinaryPropertyTableModel(
      binaryPropertyTable
    );

    let computedMax = undefined;
    for (let index = 0; index < propertyTableCount; index++) {
      const metadataEntityModel =
        propertyTableModel.getMetadataEntityModel(index);
      const propertyValue = metadataEntityModel.getPropertyValue(propertyId);
      if (index === 0) {
        computedMax = ArrayValues.deepClone(propertyValue);
      } else {
        computedMax = ArrayValues.deepMax(computedMax, propertyValue);
      }
    }
    return computedMax;
  }
}
