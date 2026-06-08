/*

import { util } from '@aws-appsync/utils';

export function request(ctx) {

  const start = ctx.args.StartDatetime;
  const end = ctx.args.EndDatetime;
  const nextToken = ctx.args.nextToken ?? null;


  return {
    operation: 'Query',
    index: 'Controller-Division-DeviceDatetime-index',
    query: {
      expression:
        'Controller = :controller AND Division = :division AND DeviceDatetime BETWEEN :start AND :end',
      expressionValues: util.dynamodb.toMapValues({
        ':controller': ctx.args.Controller,
        ':division': ctx.args.Division,
        ':start': ctx.args.StartDatetime,
        ':end': ctx.args.EndDatetime,
      }),
    },
    limit: 1000,
    scanIndexForward: true,
    nextToken,
  };


}

export function response(ctx) {
  console.log("count:", ctx.result?.items?.length);
  console.log("nextToken:", ctx.result?.nextToken);

  return {
    items: ctx.result?.items ?? [],
    nextToken: ctx.result?.nextToken ?? null,
  };
}

*/

import { util } from '@aws-appsync/utils';

export function request(ctx) {
  const start = ctx.args.StartDatetime;
  const end = ctx.args.EndDatetime;
  const nextToken = ctx.args.nextToken ?? null;

  return {
    operation: 'Query',
    index: 'Controller-DeviceDatetime-index',

    // ✅ Division を削除（ここが最大の変更点）
    query: {
      expression:
        'Controller = :controller AND DeviceDatetime BETWEEN :start AND :end',
      expressionValues: util.dynamodb.toMapValues({
        ':controller': ctx.args.Controller,
        ':start': start,
        ':end': end,
      }),
    },

    limit: 1000,
    scanIndexForward: true,
    nextToken,
  };
}

export function response(ctx) {
  if (ctx.error) {
    util.error(ctx.error.message, ctx.error.type, ctx.result);
  }

  console.log("count:", ctx.result?.items?.length);
  console.log("nextToken:", ctx.result?.nextToken);

  // ✅ デバッグ（最初だけ入れておくと安心）
  if (ctx.result?.items?.length) {
    console.log("first item:", JSON.stringify(ctx.result.items[0], null, 2));
  }

  return {
    items: ctx.result?.items ?? [],
    nextToken: ctx.result?.nextToken ?? null,
  };
}