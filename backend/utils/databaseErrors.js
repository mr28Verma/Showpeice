'use strict';

const unavailableDatabaseCodes = new Set([
    'P1000',
    'P1001',
    'P1002',
    'P1008',
    'P1017',
    'P2021',
    'P2022',
    'P2024',
]);

function isDatabaseUnavailable(error) {
    return unavailableDatabaseCodes.has(error?.code);
}

module.exports = { isDatabaseUnavailable };
