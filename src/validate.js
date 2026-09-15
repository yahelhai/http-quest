'use strict';

// Validates request bodies against a schema (src/schemas.js) and query
// parameters against a schema's `queries` list. Errors are { field, code, message }.

function err(field, code, message) {
  return { field, code, message };
}

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function checkType(field, value, type) {
  if (type === 'integer') {
    if (typeof value !== 'number' || !Number.isInteger(value)) {
      return err(field.name, 'type', `${field.name} must be an integer`);
    }
  } else if (type === 'number') {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return err(field.name, 'type', `${field.name} must be a number`);
    }
  } else if (type === 'string') {
    if (typeof value !== 'string') {
      return err(field.name, 'type', `${field.name} must be a string`);
    }
  } else if (type === 'enum') {
    if (typeof value !== 'string') {
      return err(field.name, 'type', `${field.name} must be a string`);
    }
  }
  return null;
}

// Validate a single field's value against its definition. Returns the first
// error found, or null.
function checkField(field, value) {
  const typeErr = checkType(field, value, field.type);
  if (typeErr) return typeErr;

  if (field.type === 'enum' && Array.isArray(field.values) && !field.values.includes(value)) {
    return err(field.name, 'enum', `${field.name} must be one of: ${field.values.join(', ')}`);
  }

  if ((field.type === 'integer' || field.type === 'number') && typeof value === 'number') {
    if (typeof field.min === 'number' && value < field.min) {
      return err(field.name, 'min', `${field.name} must be >= ${field.min}`);
    }
    if (typeof field.max === 'number' && value > field.max) {
      return err(field.name, 'max', `${field.name} must be <= ${field.max}`);
    }
  }

  if (field.type === 'string' && typeof value === 'string') {
    if (typeof field.minLength === 'number' && value.length < field.minLength) {
      return err(field.name, 'minLength', `${field.name} must be at least ${field.minLength} characters`);
    }
  }

  return null;
}

// Check a `ref` field: the referenced id must exist in the store.
// Requires store lazily to avoid circular requires (store -> seed -> ... -> validate).
function checkRef(field, value) {
  if (!field.ref) return null;
  const store = require('./data/store');
  const schemas = require('./schemas');
  const collection = store[field.ref];
  const noun = (schemas[field.ref] && schemas[field.ref].singular) || field.ref;
  if (!collection || !collection.get(value)) {
    return err(field.name, 'ref', `${field.name} does not reference an existing ${noun}`);
  }
  return null;
}

function validate(schema, body, { partial = false } = {}) {
  const errors = [];

  if (!isPlainObject(body)) {
    errors.push(err(null, 'type', 'body must be an object'));
    return { ok: false, errors };
  }

  const fieldNames = schema.fields.map((f) => f.name);

  for (const key of Object.keys(body)) {
    const field = schema.fields.find((f) => f.name === key);
    if (!field) {
      errors.push(err(key, 'unknown', `${key} is not a recognized field`));
      continue;
    }
    if (field.readonly) {
      errors.push(err(key, 'readonly', `${key} is set by the server and cannot be sent`));
      continue;
    }
  }

  for (const field of schema.fields) {
    if (field.readonly) continue;
    const present = Object.prototype.hasOwnProperty.call(body, field.name);

    if (!present) {
      if (field.required && !partial) {
        errors.push(err(field.name, 'required', `${field.name} is required`));
      }
      continue;
    }

    const value = body[field.name];
    const fieldErr = checkField(field, value);
    if (fieldErr) {
      errors.push(fieldErr);
      continue;
    }

    if (field.ref) {
      const refErr = checkRef(field, value);
      if (refErr) errors.push(refErr);
    }
  }

  return { ok: errors.length === 0, errors };
}

// Coerce and validate query string parameters against a `queries` definition list.
function validateQuery(queries, reqQuery) {
  const errors = [];
  const coerced = {};

  for (const q of queries) {
    if (!Object.prototype.hasOwnProperty.call(reqQuery, q.name)) continue;

    const raw = reqQuery[q.name];
    const strValue = Array.isArray(raw) ? raw[raw.length - 1] : raw;

    if (q.type === 'integer') {
      if (typeof strValue !== 'string' || !/^-?\d+$/.test(strValue)) {
        errors.push(err(q.name, 'type', `${q.name} must be an integer`));
        continue;
      }
      const num = parseInt(strValue, 10);
      if (typeof q.min === 'number' && num < q.min) {
        errors.push(err(q.name, 'min', `${q.name} must be >= ${q.min}`));
        continue;
      }
      if (typeof q.max === 'number' && num > q.max) {
        errors.push(err(q.name, 'max', `${q.name} must be <= ${q.max}`));
        continue;
      }
      coerced[q.name] = num;
    } else if (q.type === 'number') {
      const num = Number(strValue);
      if (typeof strValue !== 'string' || strValue.trim() === '' || !Number.isFinite(num)) {
        errors.push(err(q.name, 'type', `${q.name} must be a number`));
        continue;
      }
      if (typeof q.min === 'number' && num < q.min) {
        errors.push(err(q.name, 'min', `${q.name} must be >= ${q.min}`));
        continue;
      }
      if (typeof q.max === 'number' && num > q.max) {
        errors.push(err(q.name, 'max', `${q.name} must be <= ${q.max}`));
        continue;
      }
      coerced[q.name] = num;
    } else if (q.type === 'enum') {
      if (!Array.isArray(q.values) || !q.values.includes(strValue)) {
        errors.push(err(q.name, 'enum', `${q.name} must be one of: ${(q.values || []).join(', ')}`));
        continue;
      }
      coerced[q.name] = strValue;
    } else {
      // string, or anything else: pass through as-is
      coerced[q.name] = strValue;
    }
  }

  return { ok: errors.length === 0, errors, query: coerced };
}

module.exports = { validate, validateQuery };
