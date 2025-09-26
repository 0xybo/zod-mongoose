import { Schema, type SchemaOptions, SchemaTypes } from "mongoose";
import type { ZodNumber, ZodObject, ZodRawShape, ZodString, ZodType, z } from "zod";

import zmAssert from "./assertions/assertions.js";
import type { zm } from "./mongoose.types.js";
import { enhanceZodInstance } from "./extension.js";
export * from "./extension.js";

/**
 * Converts a Zod schema to a Mongoose schema
 * @param schema zod schema to parse
 * @returns mongoose schema
 *
 * @example
 * import { extendZod, zodSchema } from '@zodyac/zod-mongoose';
 * import { model } from 'mongoose';
 * import { z } from 'zod';
 *
 * extendZod(z);
 *
 * const zUser = z.object({
 *   name: z.string().min(3).max(255),
 *   age: z.number().min(18).max(100),
 *   active: z.boolean().default(false),
 *   access: z.enum(['admin', 'user']).default('user'),
 *   companyId: zId('Company'),
 *   address: z.object({
 *     street: z.string(),
 *     city: z.string(),
 *     state: z.enum(['CA', 'NY', 'TX']),
 *   }),
 *   tags: z.array(z.string()),
 *   createdAt: z.date(),
 *   updatedAt: z.date(),
 * });
 *
 * const schema = zodSchema(zDoc);
 * const userModel = model('User', schema);
 */
export function zodSchema<T extends ZodRawShape>(
  schema: ZodObject<T>,
  options?: SchemaOptions<any>, // TODO: Fix any
): Schema<z.infer<typeof schema>> {
  const definition = parseObject(schema);
  return new Schema<z.infer<typeof schema>>(definition, options);
}

/**
 * Converts a Zod schema to a raw Mongoose schema object
 * @param schema zod schema to parse
 * @returns mongoose schema
 *
 * @example
 * import { extendZod, zodSchemaRaw } from '@zodyac/zod-mongoose';
 * import { model, Schema } from 'mongoose';
 * import { z } from 'zod';
 *
 * extendZod(z);
 *
 * const zUser = z.object({
 *   name: z.string().min(3).max(255),
 *   age: z.number().min(18).max(100),
 *   active: z.boolean().default(false),
 *   access: z.enum(['admin', 'user']).default('user'),
 *   companyId: zId('Company'),
 *   address: z.object({
 *    street: z.string(),
 *    city: z.string(),
 *    state: z.enum(['CA', 'NY', 'TX']),
 *   }),
 *  tags: z.array(z.string()),
 *  createdAt: z.date(),
 *  updatedAt: z.date(),
 * });
 *
 * const rawSchema = zodSchemaRaw(zDoc);
 * const schema = new Schema(rawSchema);
 * const userModel = model('User', schema);
 */
export function zodSchemaRaw<T extends ZodRawShape>(schema: ZodObject<T>): zm._Schema<T> {
  return parseObject(schema);
}

// Helpers
// Helper function to extract validation from zod v4 checks array
function extractValidationFromChecks(checks: any[] | undefined): zm.EffectValidator<any> | null {
  if (!checks || checks.length === 0) return null;
  
  for (const check of checks) {
    // Check for validation metadata stored by our extension
    if (check && check.def && check.def.__zm_validation) {
      return check.def.__zm_validation;
    }
    // Also check for validation in the check itself
    if (check && check.__zm_validation) {
      return check.__zm_validation;
    }
    
    // In Zod v4, extract validation from custom checks
    if (check && check.def && check.def.type === 'custom' && check.def.fn) {
      let message: string | undefined = undefined;
      
      // Try to extract error message
      if (typeof check.def.error === 'function') {
        try {
          // Call the error function to get the message
          const errorResult = check.def.error();
          if (typeof errorResult === 'string') {
            message = errorResult;
          } else if (errorResult && typeof errorResult.message === 'string') {
            message = errorResult.message;
          }
        } catch (e) {
          // Error function might need specific parameters, ignore errors
        }
      }
      
      return {
        validator: check.def.fn,
        message: message || 'Validation failed',
      };
    }
  }
  
  return null;
}

function parseObject<T extends ZodRawShape>(obj: ZodObject<T>): zm._Schema<T> {
  const object: any = {};
  for (const [key, field] of Object.entries(obj.shape)) {
    // Enhance each field instance
    const enhancedField = enhanceZodInstance(field);
    
    if (zmAssert.object(enhancedField as any)) {
      object[key] = parseObject(enhancedField as any);
    } else {
      const f = parseField(enhancedField as any);
      if (!f) throw new Error(`Unsupported field type: ${(enhancedField as any).constructor}`);

      object[key] = f;
    }
  }

  return object;
}

function parseField<T>(
  field: any, // Changed from ZodType<T> to any for Zod v4 compatibility
  required = true,
  def?: zm.mDefault<T>,
  refinement?: zm.EffectValidator<T>,
): zm.mField | null {
  // Enhance the field instance to ensure custom methods work
  field = enhanceZodInstance(field);
  
  if (zmAssert.objectId(field)) {
    const ref = (<any>field).__zm_ref;
    const refPath = (<any>field).__zm_refPath;
    const unique = (<any>field).__zm_unique;
    const sparse = (<any>field).__zm_sparse;
    return parseObjectId(required, ref, unique, refPath, sparse);
  }

  if (zmAssert.uuid(field)) {
    const ref = (<any>field).__zm_ref;
    const refPath = (<any>field).__zm_refPath;
    const unique = (<any>field).__zm_unique;
    const sparse = (<any>field).__zm_unique;
    return parseUUID(required, ref, unique, refPath, sparse);
  }

  if (zmAssert.object(field)) {
    return parseObject(field);
  }

  if (zmAssert.number(field)) {
    const isUnique = field.__zm_unique ?? false;
    const isSparse = field.__zm_sparse ?? false;
    
    // Extract refinement validation from checks in zod v4
    const validation = extractValidationFromChecks(field._def.checks);
    
    return parseNumber(
      field,
      required,
      def as zm.mDefault<number>,
      isUnique,
      validation || (refinement as zm.EffectValidator<number>),
      isSparse,
    );
  }

  if (zmAssert.string(field)) {
    const isUnique = field.__zm_unique ?? false;
    const isSparse = field.__zm_sparse ?? false;
    
    // Extract refinement validation from checks in zod v4
    const validation = extractValidationFromChecks(field._def.checks);
    
    return parseString(
      field,
      required,
      def as zm.mDefault<string>,
      isUnique,
      validation || (refinement as zm.EffectValidator<string>),
      isSparse,
    );
  }

  if (zmAssert.enumerable(field)) {
    return parseEnum((field as any).options, required, def as zm.mDefault<string>);
  }

  if (zmAssert.boolean(field)) {
    return parseBoolean(required, def as zm.mDefault<boolean>);
  }

  if (zmAssert.date(field)) {
    const isUnique = field.__zm_unique ?? false;
    const isSparse = field.__zm_sparse ?? false;
    
    // Extract refinement validation from checks in zod v4
    const validation = extractValidationFromChecks(field._def.checks);
    
    return parseDate(
      required,
      def as zm.mDefault<Date>,
      validation || (refinement as zm.EffectValidator<Date>),
      isUnique,
      isSparse,
    );
  }

  if (zmAssert.array(field)) {
    // Extract validation from the array element if it has checks
    let elementValidation = null;
    const element = field.element;
    
    // Enhance the element to ensure it works with refinements
    enhanceZodInstance(element);
    
    if (element && element._def && element._def.checks) {
      elementValidation = extractValidationFromChecks(element._def.checks);
    }
    
    return parseArray(
      required,
      element,
      def as zm.mDefault<T extends Array<infer K> ? K[] : never>,
      elementValidation,
    );
  }

  if (zmAssert.def(field)) {
    return parseField(field._def.innerType, required, () => field._def.defaultValue);
  }

  if (zmAssert.optional(field)) {
    return parseField(field._def.innerType, false, undefined);
  }

  if (zmAssert.nullable(field)) {
    return parseField(
      field._def.innerType,
      false,
      (typeof def !== "undefined" ? def : () => null) as zm.mDefault<null>,
    );
  }

  if (zmAssert.union(field)) {
    return parseField(field._def.options[0]);
  }

  if (zmAssert.any(field)) {
    return parseMixed(required, def);
  }

  if (zmAssert.mapOrRecord(field)) {
    const mapField = field as any;
    return parseMap(
      required,
      mapField.valueType,
      def as zm.mDefault<Map<any, any>>,
    );
  }

  if (zmAssert.pipe(field)) {
    // ZodPipe represents both preprocess and transform in zod v4
    const pipeData = (field._def as any);
    const inputType = pipeData.in;
    const outputType = pipeData.out;
    
    // Determine if this is a preprocess or transform operation
    // Preprocess: input is transform, output is the target type -> use output type
    // Transform: input is the source type, output is transform -> use input type
    const isPreprocess = inputType && inputType.type === 'transform' && outputType && outputType.type !== 'transform';
    
    if (isPreprocess) {
      // For preprocess, use the output type (what gets stored in database)
      return parseField(outputType, required, def, refinement);
    } else {
      // For transform, use the input type (what gets stored in database) 
      return parseField(inputType, required, def, refinement);
    }
  }

  if (zmAssert.effect(field)) {
    // In Zod v4, ZodTransform is now represented as pipes with in/out properties
    const def = field._def as any;
    
    // Extract unique and sparse properties from the original field if it exists
    const originalField = def.in || def.schema;
    const unique = originalField && (originalField as any).__zm_unique || false;
    const sparse = originalField && (originalField as any).__zm_sparse || false;

    // Handle refinement type (custom checks on the schema)
    if (def.type === "string" || def.type === "number" || def.type === "date") {
      // This is likely a refined primitive type
      const validation = refinement; // Use the passed refinement
      
      // Parse the field as its base type and then apply unique/sparse if needed
      const parsed = parseField(originalField || field, required, def, validation);
      if (parsed && typeof parsed === 'object' && 'type' in parsed) {
        (parsed as any).unique = unique;
        (parsed as any).sparse = sparse;
      }
      return parsed;
    }

    // Handle transformation cases
    if (def.type === "pipe" || def.type === "transform") {
      const parsed = parseField(originalField, required, def, refinement);
      if (parsed && typeof parsed === 'object' && 'type' in parsed) {
        (parsed as any).unique = unique;
        (parsed as any).sparse = sparse;
      }
      return parsed;
    }
  }

  return null;
}

function parseNumber(
  field: ZodNumber,
  required = true,
  def?: zm.mDefault<number>,
  unique = false,
  validate?: zm.EffectValidator<number>,
  sparse = false,
): zm.mNumber {
  const output: zm.mNumber = {
    type: Number,
    default: def,
    min: field.minValue ?? undefined,
    max: field.maxValue ?? undefined,
    required,
    unique,
    sparse,
  };

  if (validate) output.validate = validate;
  return output;
}

function parseString(
  field: ZodString,
  required = true,
  def?: zm.mDefault<string>,
  unique = false,
  validate?: zm.EffectValidator<string>,
  sparse = false,
): zm.mString {
  const output: zm.mString = {
    type: String,
    default: def,
    required,
    minLength: field.minLength ?? undefined,
    maxLength: field.maxLength ?? undefined,
    unique,
    sparse,
  };

  if (validate) output.validate = validate;
  return output;
}

function parseEnum(
  values: string[],
  required = true,
  def?: zm.mDefault<string>,
): zm.mString {
  return {
    type: String,
    unique: false,
    sparse: false,
    default: def,
    enum: values,
    required,
  };
}

function parseBoolean(required = true, def?: zm.mDefault<boolean>): zm.mBoolean {
  return {
    type: Boolean,
    default: def,
    required,
  };
}

function parseDate(
  required = true,
  def?: zm.mDefault<Date>,
  validate?: zm.EffectValidator<Date>,
  unique = false,
  sparse = false,
): zm.mDate {
  const output: zm.mDate = {
    type: Date,
    default: def,
    required,
    unique,
    sparse,
  };

  if (validate) output.validate = validate;
  return output;
}

function parseObjectId(
  required = true,
  ref?: string,
  unique = false,
  refPath?: string,
  sparse = false,
): zm.mObjectId {
  const output: zm.mObjectId = {
    type: SchemaTypes.ObjectId,
    required,
    unique,
    sparse,
  };

  if (ref) output.ref = ref;
  if (refPath) output.refPath = refPath;
  return output;
}

function parseArray<T>(
  // biome-ignore lint/style/useDefaultParameterLast: Should be consistent with other functions
  required = true,
  element: any, // Changed from ZodType<T> to any for Zod v4 compatibility
  def?: zm.mDefault<T[]>,
  elementValidation?: zm.EffectValidator<T> | null,
): zm.mArray<T> {
  const innerType = parseField(element, true, undefined, elementValidation || undefined);
  if (!innerType) throw new Error("Unsupported array type");
  return {
    type: [innerType as zm._Field<T>],
    default: def,
    required,
  };
}

function parseMap<T, K>(
  // biome-ignore lint/style/useDefaultParameterLast: Consistency with other functions
  required = true,
  valueType: any, // Changed from ZodType<K> to any for Zod v4 compatibility
  def?: zm.mDefault<Map<NoInfer<T>, K>>,
): zm.mMap<T, K> {
  const pointer = parseField(valueType);
  if (!pointer) throw new Error("Unsupported map value type");

  return {
    type: Map,
    of: pointer as zm._Field<K>,
    default: def,
    required,
  };
}

function parseUUID(
  required = true,
  ref?: string,
  unique = false,
  refPath?: string,
  sparse = false,
): zm.mUUID {
  const output: zm.mUUID = {
    type: SchemaTypes.UUID,
    required,
    unique,
    sparse,
  };
  if (ref) output.ref = ref;
  if (refPath) output.refPath = refPath;
  return output;
}

function parseMixed(required = true, def?: unknown): zm.mMixed<unknown> {
  return {
    type: SchemaTypes.Mixed,
    default: def as unknown as any,
    required,
  };
}

export default zodSchema;
