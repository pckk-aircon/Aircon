/*

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

*/

import { util } from '@aws-appsync/utils';

export function request(ctx) {

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
    scanIndexForward: true
  };
}

export function response(ctx) {

  // デバッグ（重要）
  console.log("count:", ctx.result?.items?.length);
  console.log("nextToken:", ctx.result?.nextToken);

  return ctx.result?.items ?? [];
}
