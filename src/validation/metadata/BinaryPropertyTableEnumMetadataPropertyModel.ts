import { PropertyModel } from "3d-tiles-tools";
import { MetadataValues } from "3d-tiles-tools";
import { BinaryPropertyModels } from "3d-tiles-tools";

import { BinaryPropertyTable } from "3d-tiles-tools";
import { ClassProperty } from "3d-tiles-tools";

import { MetadataPropertyModel } from "./MetadataPropertyModel";

/**
 * Implementation of a `MetadataPropertyModel` for ENUM properties
 * in a binary property table
 *
 * @internal
 */
export class BinaryPropertyTableEnumMetadataPropertyModel
  implements MetadataPropertyModel<number>
{
  /**
   * The underlying binary property table data
   */
  private readonly binaryPropertyTable: BinaryPropertyTable;

  /**
   * The property table property that is represented by this model
   */
  private readonly propertyTableProperty: any;

  /**
   * The class property that defines the structure of the property
   */
  private readonly classProperty: ClassProperty;

  /**
   * The mapping from enum value values to enum value names for
   * the enum type of the given class property
   */
  private readonly enumValueValueNames: { [key: number]: string };

  /**
   * The property model for the property
   */
  private readonly propertyModel: PropertyModel;

  /**
   * Creates a new instance
   *
   * @param binaryPropertyTable - The binary property table
   * @param propertyName - The property name
   * @param propertyTableProperty - The property table property
   * @param classProperty - The class property
   * @param enumValueValueNames - The mapping from enum value values
   * to enum value names for the enum type of the given class
   * property
   */
  constructor(
    binaryPropertyTable: BinaryPropertyTable,
    propertyName: string,
    propertyTableProperty: any,
    classProperty: ClassProperty,
    enumValueValueNames: { [key: number]: string }
  ) {
    this.binaryPropertyTable = binaryPropertyTable;
    this.propertyTableProperty = propertyTableProperty;
    this.classProperty = classProperty;
    this.enumValueValueNames = enumValueValueNames;
    this.propertyModel = BinaryPropertyModels.createPropertyModel(
      binaryPropertyTable,
      propertyName
    );
  }
  /** {@inheritDoc MetadataPropertyModel.getPropertyValue} */
  getPropertyValue(key: number) {
    const propertyAttributeProperty = this.propertyTableProperty;
    const classProperty = this.classProperty;

    const offsetOverride = propertyAttributeProperty.offset;
    const scaleOverride = propertyAttributeProperty.scale;

    const value = this.getRawPropertyValue(key);
    if (classProperty.enumType !== undefined) {
      const processedValue = MetadataValues.processNumericEnumValue(
        classProperty,
        this.enumValueValueNames,
        value
      );
      return processedValue;
    }

    const processedValue = MetadataValues.processValue(
      classProperty,
      offsetOverride,
      scaleOverride,
      value
    );
    return processedValue;
  }

  /** {@inheritDoc MetadataPropertyModel.getRawPropertyValue} */
  getRawPropertyValue(key: number) {
    return this.propertyModel.getPropertyValue(key);
  }
}
