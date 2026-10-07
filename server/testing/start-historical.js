'use strict';
/* Explicit historical fixture entry; never a deployment start command. */
const { assertHistoricalEnvironment, registerHistoricalProtocol } = require('./legacy-protocol');
assertHistoricalEnvironment(process.env, 2);
process.env.CHUNKLAB_WRITE_PROTOCOL = '2';
global.__chunklabHistoricalRouteRegistrar = registerHistoricalProtocol;
require('../index');
