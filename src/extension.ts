import { Types, isValidObjectId } from "mongoose";
import { z } from "zod";

declare module "zod" {
  interface ZodString {
    unique: (arg?: boolean) => ZodString;
    sparse: (arg?: boolean) => ZodString;
    __zm_unique: boolean;
    __zm_sparse: boolean;
  }

  interface ZodNumber {
    unique: (arg?: boolean) => ZodNumber;
    sparse: (arg?: boolean) => ZodNumber;
    __zm_unique: boolean;
    __zm_sparse: boolean;
  }

  interface ZodDate {
    unique: (arg?: boolean) => ZodDate;
    sparse: (arg?: boolean) => ZodDate;
    __zm_unique: boolean;
    __zm_sparse: boolean;
  }
}

let zod_extended = false;
/**
 * Extends the Zod library with additional functionality.
 *
 * This function modifies the Zod library to add custom validation and uniqueness checks.
 * It ensures that the extension is only applied once.
 *
 * @param z_0 - The Zod library to extend.
 *
 * @remarks
 * - Overrides `refine` method to `ZodType` that includes additional metadata for validation.
 * - Overrides `unique` method to `ZodString`, `ZodNumber`, and `ZodDate` to mark them as unique.
 * - Overrides `sparse` method to `ZodString`, `ZodNumber`, and `ZodDate` to mark them as sparse.
 *
 * @example
 * ```typescript
 * import { z } from "zod";
 * import { extendZod } from "./extension";
 *
 * extendZod(z);
 *
 * const schema = z.object({
 *   name: z.string().unique();
 * });
 * ```
 */
export function extendZod(z_0: typeof z) {
  // Prevent zod from being extended multiple times
  if (zod_extended) return;
  zod_extended = true;

  // Unique support - Add unique() and sparse() methods to specific types
  const UNIQUE_SUPPORT_LIST = [z_0.ZodString, z_0.ZodNumber, z_0.ZodDate] as const;

  for (const type of UNIQUE_SUPPORT_LIST) {
    (<any>type.prototype).unique = function (arg = true) {
      (<any>this).__zm_unique = arg;
      // Enhance this instance to ensure refine preserves unique properties
      enhanceZodInstance(this);
      return this;
    };

    (<any>type.prototype).sparse = function (arg = true) {
      (<any>this).__zm_sparse = arg;
      // Enhance this instance to ensure refine preserves sparse properties
      enhanceZodInstance(this);
      return this;
    };
  }

  // Assign static names to Zod types
  const TypesMap = {
    String: z_0.ZodString,
    Number: z_0.ZodNumber,
    Object: z_0.ZodObject,
    Array: z_0.ZodArray,
    Boolean: z_0.ZodBoolean,
    Enum: z_0.ZodEnum,
    Date: z_0.ZodDate,
    Default: z_0.ZodDefault,
    Optional: z_0.ZodOptional,
    Nullable: z_0.ZodNullable,
    Union: z_0.ZodUnion,
    Any: z_0.ZodAny,
    Map: z_0.ZodMap,
    Record: z_0.ZodRecord,
    Effects: z_0.ZodTransform,
    Pipe: z_0.ZodPipe,
  };

  for (const [key, value] of Object.entries(TypesMap)) {
    (<any>value.prototype).__zm_type = key;
  }
}

/**
 * Enhance a Zod instance with custom validation extraction capabilities
 * This is called from the parsing logic to ensure instances work correctly
 */
export function enhanceZodInstance(instance: any) {
  if (!instance || typeof instance !== 'object') return instance;
  
  // Check if this instance has already been enhanced
  if (instance.__zm_enhanced) return instance;
  instance.__zm_enhanced = true;

  // Store original refine method if it exists
  if (typeof instance.refine === 'function') {
    const originalRefine = instance.refine;
    
    // Override refine method to preserve custom properties
    instance.refine = function(check: any, opts?: any) {
      const refined = originalRefine.call(this, check, opts);
      
      let message: string | undefined = undefined;
      if (opts) {
        if (typeof opts === "string") message = opts;
        else if (typeof opts === "object" && "message" in opts) message = opts.message;
      }

      // Preserve custom properties from the original schema
      const originalUnique = this.__zm_unique;
      const originalSparse = this.__zm_sparse;
      
      if (originalUnique !== undefined) {
        refined.__zm_unique = originalUnique;
      }
      if (originalSparse !== undefined) {
        refined.__zm_sparse = originalSparse;
      }

      // Store validation metadata in the refinement check for zod v4
      const checks = refined._def?.checks;
      if (checks && checks.length > 0) {
        const lastCheck = checks[checks.length - 1];
        if (lastCheck && lastCheck.def && lastCheck.def.type === 'custom') {
          lastCheck.def.__zm_validation = {
            validator: check,
            message: message,
          };
        }
      }

      return enhanceZodInstance(refined); // Recursively enhance refined instances
    };
  }

  return instance;
}

export type TzmId = ReturnType<typeof createId> & {
  unique: (arg?: boolean) => TzmId;
  sparse: (arg?: boolean) => TzmId;
  ref: (arg: string) => TzmId;
  refPath: (arg: string) => TzmId;
};

const createId = () => {
  return z
    .string()
    .refine((v) => isValidObjectId(v), { message: "Invalid ObjectId" })
    .or(z.instanceof(Types.ObjectId));
};

export const zId = (ref?: string): TzmId => {
  const output = createId();

  (<any>output).__zm_type = "ObjectId";
  (<any>output).__zm_ref = ref;

  (<any>output).ref = function (ref: string) {
    (<any>this).__zm_ref = ref;
    return this;
  };

  (<any>output).refPath = function (ref: string) {
    (<any>this).__zm_refPath = ref;
    return this;
  };

  (<any>output).unique = function (val = true) {
    (<any>this).__zm_unique = val;
    return this;
  };

  (<any>output).sparse = function (val = true) {
    (<any>this).__zm_sparse = val;
    return this;
  };

  return output as TzmId;
};

export type TzmUUID = ReturnType<typeof createUUID> & {
  unique: (arg?: boolean) => TzmUUID;
  sparse: (arg?: boolean) => TzmUUID;
  ref: (arg: string) => TzmUUID;
  refPath: (arg: string) => TzmUUID;
};

const createUUID = () => {
  return z.string().uuid({ message: "Invalid UUID" }).or(z.instanceof(Types.UUID));
};

export const zUUID = (ref?: string): TzmUUID => {
  const output = createUUID();

  (<any>output).__zm_type = "UUID";
  (<any>output).__zm_ref = ref;

  (<any>output).ref = function (ref: string) {
    (<any>this).__zm_ref = ref;
    return this;
  };

  (<any>output).refPath = function (ref: string) {
    (<any>this).__zm_refPath = ref;
    return this;
  };

  (<any>output).unique = function (val = true) {
    (<any>this).__zm_unique = val;
    return this;
  };

  (<any>output).sparse = function (val = true) {
    (<any>this).__zm_sparse = val;
    return this;
  };

  return output as TzmUUID;
};
