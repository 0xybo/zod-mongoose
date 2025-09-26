import { z } from 'zod';
import { readFileSync } from 'fs';

const pkg = JSON.parse(readFileSync('./node_modules/zod/package.json', 'utf8'));
console.log('Zod version from package:', pkg.version);

console.log('\nChecking for Effects/Transform:');
console.log('z.ZodEffects:', typeof z.ZodEffects);
console.log('z.ZodTransform:', typeof z.ZodTransform);

console.log('\nChecking TypesMap values:');
const TypesMap = {
  String: z.ZodString,
  Number: z.ZodNumber,
  Object: z.ZodObject,
  Array: z.ZodArray,
  Boolean: z.ZodBoolean,
  Enum: z.ZodEnum,
  Date: z.ZodDate,
  Default: z.ZodDefault,
  Optional: z.ZodOptional,
  Nullable: z.ZodNullable,
  Union: z.ZodUnion,
  Any: z.ZodAny,
  Map: z.ZodMap,
  Record: z.ZodRecord,
  Effects: z.ZodEffects,
  Transform: z.ZodTransform,
};

for (const [key, value] of Object.entries(TypesMap)) {
  if (value) {
    console.log(`${key}: function - hasPrototype: yes`);
  } else {
    console.log(`${key}: undefined - hasPrototype: no`);
  }
}