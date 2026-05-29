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
  return {
    operation: 'Query',
    query: {
      expression: 'Controller = :controller AND DeviceDatetime >= :startDatetime',
      expressionValues: util.dynamodb.toMapValues({ 
        ':controller': ctx.args.Controller,
        ':startDatetime': ctx.args.StartDatetime
      })
    },
    index: 'Controller-DeviceDatetime-index',

    // ✅ 最大件数
    limit: 10000,

    // ✅ Pagination対応（これが超重要）
    nextToken: ctx.args.nextToken,

    // ✅ 並び順（用途に応じて）
    // false = 新しい順（現状維持）
    // true  = 古い順（データ全取得向き）
    scanIndexForward: false
  };
}

export const response = (ctx) => {
  return {
    items: ctx.result.items,
    nextToken: ctx.result.nextToken
  };
};
