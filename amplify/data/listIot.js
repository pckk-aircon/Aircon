
/*
import { util } from '@aws-appsync/utils';

export function request(ctx) {
  return {
    operation: 'Query',
    query: {
      expression: 'Controller = :controller AND DeviceDatetime BETWEEN :startDatetime AND :endDatetime',
      expressionValues: util.dynamodb.toMapValues({ 
        ':controller': ctx.args.Controller,
        ':startDatetime': ctx.args.StartDatetime,
        ':endDatetime': ctx.args.EndDatetime
      })
    },
    index: 'Controller-DeviceDatetime-index',
    limit: 10000, // ← 1回で返す最大件数を増やす。AppSyncのデフォルトは約1000件。
    scanIndexForward: false   // ← ★これが重要
  };
}

export const response = (ctx) => ctx.result.items;
*/

import { util } from '@aws-appsync/utils';

export function request(ctx) {

  // ✅ ★ここが最重要修正：T形式に統一
  const start = String(ctx.args.StartDatetime).replace(" ", "T");
  const end   = String(ctx.args.EndDatetime).replace(" ", "T");

  return {
    operation: 'Query',
    query: {
      expression: 'Controller = :controller AND DeviceDatetime BETWEEN :startDatetime AND :endDatetime',
      expressionValues: util.dynamodb.toMapValues({ 
        ':controller': ctx.args.Controller,
        ':startDatetime': start,
        ':endDatetime': end
      })
    },
    index: 'Controller-DeviceDatetime-index',
    limit: 10000,
    scanIndexForward: false
  };
}

// ✅ デバッグ（原因確認用：一度だけ有効化推奨）
export const response = (ctx) => {
  console.log("QUERY RESULT SAMPLE:", ctx.result.items?.slice(0, 5));
  return ctx.result.items;
};

