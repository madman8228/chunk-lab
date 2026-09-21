'use strict';
const Ajv2020 = require('ajv/dist/2020').default;
const Ajv = require('ajv').default;
function validate(schema, data) {
  if (!schema || typeof schema !== 'object') return { valid: false, errors: [{ message: '课程包缺少有效 JSON Schema' }] };
  let externalRef = false;
  (function scan(value) {
    if (!value || typeof value !== 'object' || externalRef) return;
    Object.keys(value).forEach(function (key) {
      if (key === '$ref' && typeof value[key] === 'string' && value[key].charAt(0) !== '#') externalRef = true;
      else if (key !== '$ref') scan(value[key]);
    });
  }(schema));
  if (externalRef) return { valid: false, errors: [{ message: '课程包 Schema 不允许外部引用' }] };
  const AjvClass = /draft-07|draft-06|draft-04/i.test(String(schema.$schema || '')) ? Ajv : Ajv2020;
  const ajv = new AjvClass({ allErrors: true, strict: false, code: { source: true } });
  let check;
  try { check = ajv.compile(schema); } catch (error) { return { valid: false, errors: [{ message: 'Schema 编译失败：' + error.message }] }; }
  const valid = check(data);
  return { valid: !!valid, errors: (check.errors || []).map(function (error) { return error.instancePath + ' ' + error.message; }) };
}
if (typeof window !== 'undefined') window.CourseSchemaValidator = { validate: validate };
module.exports = { validate: validate };
