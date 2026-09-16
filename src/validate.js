// Checks bodies and query strings against the definitions in src/schemas.js.
// Both return plain sentences, which the API sends back as `details`.

const store = require('./data/store');
const schemas = require('./schemas');

function isObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// Returns what is wrong with one value, or null.
function checkValue(field, value) {
  if (field.type === 'integer' && !Number.isInteger(value)) return `${field.name} must be a whole number`;
  if (field.type === 'number' && !Number.isFinite(value)) return `${field.name} must be a number`;

  if (field.type === 'string' || field.type === 'enum') {
    if (typeof value !== 'string') return `${field.name} must be text`;
    if (value.trim() === '') return `${field.name} cannot be empty`;
  }

  if (field.values && !field.values.includes(value)) {
    return `${field.name} must be one of: ${field.values.join(', ')}`;
  }
  if (field.min !== undefined && value < field.min) return `${field.name} must be ${field.min} or more`;
  if (field.max !== undefined && value > field.max) return `${field.name} must be ${field.max} or less`;

  if (field.ref && !store[field.ref].find(value)) {
    return `${field.name} must be the id of an existing ${schemas[field.ref].singular}`;
  }

  return null;
}

// `partial` is for PATCH, where a missing field means "leave it alone".
function validateBody(schema, body, { partial = false } = {}) {
  if (!isObject(body)) return ['the body must be a JSON object'];

  const problems = [];

  for (const name of Object.keys(body)) {
    const field = schema.fields.find((candidate) => candidate.name === name);
    if (!field) problems.push(`${name} is not a field of ${schema.name}`);
    else if (field.readonly) problems.push(`${name} is set by the server and cannot be sent`);
  }

  for (const field of schema.fields) {
    if (field.readonly) continue;

    if (!Object.hasOwn(body, field.name)) {
      if (field.required && !partial) problems.push(`${field.name} is required`);
      continue;
    }

    const problem = checkValue(field, body[field.name]);
    if (problem) problems.push(problem);
  }

  return problems;
}

// Query values arrive as text, so they are converted to the declared type
// first. Anything the schema does not list is ignored.
function validateQuery(parameters, requestQuery) {
  const problems = [];
  const query = {};

  for (const parameter of parameters) {
    if (!Object.hasOwn(requestQuery, parameter.name)) continue;

    const text = String(requestQuery[parameter.name]);
    let value = text;

    if (parameter.type === 'integer' || parameter.type === 'number') {
      value = Number(text);
      if (text.trim() === '' || Number.isNaN(value)) {
        problems.push(`${parameter.name} must be a number`);
        continue;
      }
    }

    const problem = checkValue(parameter, value);
    if (problem) problems.push(problem);
    else query[parameter.name] = value;
  }

  return { problems, query };
}

module.exports = { validateBody, validateQuery, isObject };
