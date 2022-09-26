import { defined } from "../base/defined";

import { Validator } from "./Validator";
import { ValidationContext } from "./ValidationContext";

import { RootProperty } from "../structure/RootProperty";

import { SemanticValidationIssues } from "../issues/SemanticValidationIssues";

export interface ExtensionsValidationResult {
  allValid: boolean;
  performDefaultValidation: boolean;
}

export interface ExtensionValidator<T> {
  validateObject(input: T, context: ValidationContext): boolean;
}

/**
 * @private
 * @experimental
 */
export class ExtensionsValidator {
  static readonly extensionValidators = new Map<
    string,
    ExtensionValidator<any>
  >();
  static readonly performDefaults = new Map<string, boolean>();

  static register(
    extensionName: string,
    extensionValidator: ExtensionValidator<any>,
    performDefaultValidation: boolean
  ) {
    ExtensionsValidator.extensionValidators.set(
      extensionName,
      extensionValidator
    );
    ExtensionsValidator.performDefaults.set(
      extensionName,
      performDefaultValidation
    );
  }

  static validateExtensions(
    path: string,
    name: string,
    rootProperty: RootProperty,
    context: ValidationContext
  ): ExtensionsValidationResult {
    let allValid = true;
    let performDefaultValidation = true;

    const extensions = rootProperty.extensions;
    if (defined(extensions)) {
      const extensionNames = Object.keys(extensions!);
      for (const extensionName of extensionNames) {
        const extensionValidator =
          ExtensionsValidator.extensionValidators.get(extensionName);
        if (!defined(extensionValidator)) {
          const issue = SemanticValidationIssues.EXTENSION_NOT_SUPPORTED(
            path,
            extensionName
          );
          context.addIssue(issue);
        } else {
          const extension = extensions![extensionName];
          const isValid = ExtensionsValidator.validateExtension(
            path,
            extensionName,
            extension,
            extensionValidator!,
            context
          );
          if (!isValid) {
            allValid = false;
          }
          const performDefault =
            ExtensionsValidator.performDefaults.get(extensionName);
          if (performDefault === false) {
            performDefaultValidation = false;
          }
        }
      }
    }
    return {
      allValid: allValid,
      performDefaultValidation: performDefaultValidation,
    };
  }

  private static validateExtension(
    path: string,
    name: string,
    extension: any,
    extensionValidator: ExtensionValidator<any>,
    context: ValidationContext
  ): boolean {
    const result = extensionValidator.validateObject(extension, context);
    return result;
  }
}
