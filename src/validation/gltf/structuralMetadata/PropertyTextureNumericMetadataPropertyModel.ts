import { ClassProperty } from "3d-tiles-tools";
import { MetadataValues } from "3d-tiles-tools";
import { NumericBuffers } from "3d-tiles-tools";

import { ImageData } from "../ImageData";
import { ImageDataReader } from "../ImageDataReader";

import { MetadataPropertyModel } from "../../metadata/MetadataPropertyModel";

/**
 * Implementation of a MetadataPropertyModel for a single
 * property texture property that contains numeric values.
 *
 * @internal
 */
export class PropertyTextureNumericMetadataPropertyModel
  implements MetadataPropertyModel<[number, number]>
{
  /**
   * The image data that was read from the glTF texture
   */
  private readonly imageData: ImageData;

  /**
   * The property texture property that is represented by this model
   */
  private readonly propertyTextureProperty: any;

  /**
   * The class property that defines the structure of the property
   */
  private readonly classProperty: ClassProperty;

  /**
   * Creates a new instance
   *
   * @param imageData - The image data
   * @param propertyTextureProperty - The property texture property
   * @param classProperty - The class property
   */
  constructor(
    imageData: ImageData,
    propertyTextureProperty: any,
    classProperty: ClassProperty
  ) {
    this.imageData = imageData;
    this.propertyTextureProperty = propertyTextureProperty;
    this.classProperty = classProperty;
  }

  /** {@inheritDoc MetadataPropertyModel.getPropertyValue} */
  getPropertyValue(pixelCoordinates: [number, number]): number | number[] {
    const propertyTextureProperty = this.propertyTextureProperty;
    const classProperty = this.classProperty;

    const offsetOverride = propertyTextureProperty.offset;
    const scaleOverride = propertyTextureProperty.scale;

    const value = this.getRawPropertyValue(pixelCoordinates);

    const processedValue = MetadataValues.processValue(
      classProperty,
      offsetOverride,
      scaleOverride,
      value
    );
    return processedValue;
  }

  /** {@inheritDoc MetadataPropertyModel.getRawPropertyValue} */
  getRawPropertyValue(pixelCoordinates: [number, number]): number | number[] {
    const propertyTextureProperty = this.propertyTextureProperty;
    const classProperty = this.classProperty;
    const channels = propertyTextureProperty.channels;

    // First, collect the actual values from the image
    // data in a buffer
    const x = pixelCoordinates[0];
    const y = pixelCoordinates[1];
    const buffer = Buffer.alloc(channels.length);
    for (let c = 0; c < channels.length; c++) {
      const channelValue = ImageDataReader.getChannelValue(
        this.imageData,
        x,
        y,
        c
      );
      buffer.writeUInt8(channelValue & 0xff, c);
    }

    const componentType = classProperty.componentType!;

    // Handle array properties
    if (classProperty.array) {
      // Variable-length arrays are not supported for property
      // textures, so the `count` must be defined here
      const count = classProperty.count!;
      const value = Array<any>(count);
      for (let e = 0; e < count; e++) {
        const element = NumericBuffers.getNumericFromBuffer(
          buffer,
          e,
          componentType
        );
        value[e] = Number(element);
      }
      return value;
    }

    // Handle (non-array) properties
    const value = NumericBuffers.getNumericFromBuffer(buffer, 0, componentType);
    return Number(value);
  }
}
