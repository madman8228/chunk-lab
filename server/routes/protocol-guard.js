'use strict';

function rejectLegacyWrite(writeProtocol, res, label) {
  if (Number(writeProtocol) !== 3) return false;
  res.status(428).json({
    error: '此写入方式已升级，请刷新页面后重试' + (label ? '：' + label : ''),
    code: 'CLIENT_UPDATE_REQUIRED'
  });
  return true;
}

module.exports = { rejectLegacyWrite };
