#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');
const root = path.resolve(__dirname, '..');
const out = path.join(root, 'js', 'vendor', 'course-schema-validator.js');
fs.mkdirSync(path.dirname(out), { recursive: true });
esbuild.buildSync({ entryPoints: [path.join(__dirname, 'course-schema-validator-entry.js')], outfile: out, bundle: true, format: 'iife', platform: 'browser', globalName: 'CourseSchemaValidatorBundle', minify: true, legalComments: 'none', define: { 'process.env.NODE_ENV': '"production"' } });
console.log('[course-schema] built ' + path.relative(root, out));
