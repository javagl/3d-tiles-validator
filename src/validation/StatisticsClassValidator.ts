import { defined } from "../base/defined";

import { ValidationContext } from "./ValidationContext";
import { BasicValidator } from "./BasicValidator";

import { StatisticsClass } from "../structure/StatisticsClass";
import { Schema } from "../structure/Metadata/Schema";

import { StructureValidationIssues } from "../issues/StructureValidationIssues";

/**
 * A class for validations related to `StatisticsClass` objects.
 *
 * @private
 */
export class StatisticsClassValidator {
  /**
   * Performs the validation to ensure that the given object is a
   * valid `statisticsClass` object.
   *
   * @param statisticsClass The object to validate
   * @param className The name of the class, used as the
   * key in the `statistics.classes` dictionary, as well as the
   * key in the `schema.classes` dictionary.
   * @param schema The `Schema` object. This is either the `tileset.schema`,
   * or the `Schema` object that was read from the `schemaUri`.
   * @param context The `ValidationContext` that any issues will be added to
   * @returns Whether the object was valid
   */
  static validateStatisticsClass(
    statisticsClass: StatisticsClass,
    className: string,
    schema: Schema,
    context: ValidationContext
  ): boolean {
    const classPath = "/statistics/classes/" + className;

    // Make sure that the given value is an object
    if (
      !BasicValidator.validateObject(
        classPath,
        className,
        statisticsClass,
        context
      )
    ) {
      return false;
    }

    let result = true;

    // Each class that appears in the statistics MUST be
    // one of the classes defined in the schema
    const schemaClasses: any = defined(schema.classes) ? schema.classes : {};
    const schemaClass = schemaClasses[className];
    if (!defined(schemaClass)) {
      const message =
        `Statistics contain a class name ${className}, ` +
        `but the schema does not define this class`;
      const issue = StructureValidationIssues.IDENTIFIER_NOT_FOUND(
        classPath,
        message
      );
      context.addIssue(issue);
      result = false;
    } else {
      // Each property name of the statistics class MUST be a
      // property name of the schema class
      const schemaClassPropertyNames = Object.keys(schemaClass.properties);
      for (const statisticsClassPropetyName of Object.keys(statisticsClass)) {
        if (!schemaClassPropertyNames.includes(statisticsClassPropetyName)) {
          const message =
            `Statistics class '${className}' contains a property name ` +
            `'${statisticsClassPropetyName}', but the schema class does ` +
            `not define this property`;
          const issue = StructureValidationIssues.IDENTIFIER_NOT_FOUND(
            classPath,
            message
          );
          context.addIssue(issue);
          result = false;
        } else {
          // TODO Validate the constraints for the statistics.class.property.
          // This COULD include checks for (min>max). But first, it should
          // check the types (e.g. that 'min' is only used for numeric types)
        }
      }
    }
    return result;
  }
}