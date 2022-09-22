/* eslint-disable */
// From https://github.com/CesiumGS/3d-tiles-validator/tree/e84202480eb6572383008076150c8e52c99af3c3
// (Some parts of that state have been omitted here)

'use strict';

module.exports = {
    componentTypeToByteLength: componentTypeToByteLength,
    isBufferValidUtf8: isBufferValidUtf8,
    typeToComponentsLength: typeToComponentsLength,
    normalizePath: normalizePath
};

function normalizePath(path) {
    // on Windows, the paths get backslashes (due to path.join)
    // normalize that to be able to deal with internal zip paths
    const res = path.replace(/\.\//, "");
    return res.replace(/\\/g, '/');
}

function typeToComponentsLength(type) {
    switch (type) {
        case 'SCALAR':
            return 1;
        case 'VEC2':
            return 2;
        case 'VEC3':
            return 3;
        case 'VEC4':
            return 4;
        default:
            return undefined;
    }
}

function componentTypeToByteLength(componentType) {
    switch (componentType) {
        case 'BYTE':
        case 'UNSIGNED_BYTE':
            return 1;
        case 'SHORT':
        case 'UNSIGNED_SHORT':
            return 2;
        case 'INT':
        case 'UNSIGNED_INT':
        case 'FLOAT':
            return 4;
        case 'DOUBLE':
            return 8;
        default:
            return undefined;
    }
}

function isBufferValidUtf8(buffer){
    return Buffer.compare(Buffer.from(buffer.toString()), buffer) === 0;
}

