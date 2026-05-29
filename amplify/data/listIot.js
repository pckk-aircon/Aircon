
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

  // ✅ 文字列そのまま使う（絶対に Date変換しない）
  const start = ctx.args.StartDatetime;
  const end   = ctx.args.EndDatetime;

  return {
    operation: 'Query',
    query: {
      expression: 'Controller = :controller AND DeviceDatetime BETWEEN :start AND :end',
      expressionValues: util.dynamodb.toMapValues({ 
        ':controller': ctx.args.Controller,
        ':start': start,
        ':end': end
      })
    },
    index: 'Controller-DeviceDatetime-index',
    limit: 10000,
    scanIndexForward: true  // ← 昇順（推奨）
  };
}

export function response(ctx) {
  return ctx.result?.items ?? [];
}