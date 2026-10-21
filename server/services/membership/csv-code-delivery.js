'use strict';

function csvCell(value) {
  let text = String(value == null ? '' : value);
  if (/^[\s\u0000-\u001f]*[=+@\-]/.test(text)) text = "'" + text;
  return '"' + text.replace(/"/g, '""') + '"';
}

function buildCodeCsv(batch, issuedCodes) {
  const rows = [['batch_id', 'code_id', 'plan_key', 'term_months', 'redeem_by', 'code']];
  for (const item of issuedCodes) rows.push([batch.batchId, item.codeId, batch.plan.key,
    batch.plan.termMonths, batch.redeemBy == null ? '' : new Date(batch.redeemBy).toISOString(), item.code]);
  return '\uFEFF' + rows.map(row => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

module.exports = { buildCodeCsv, csvCell };
