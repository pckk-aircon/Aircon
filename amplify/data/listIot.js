/*


import { util } from '@aws-appsync/utils';

export function request(ctx) {
  const start = ctx.args.StartDatetime;
  const end = ctx.args.EndDatetime;
  const nextToken = ctx.args.nextToken ?? null;

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
    scanIndexForward: true,
    nextToken, // ★追加
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
  var nextToken = ctx.args.nextToken ? ctx.args.nextToken : null;

  return {
    operation: 'Query',
    index: 'Controller-Division-DatetimeAgg-index',
    query: {
      expression:
        'Controller = :controller AND Division = :division AND DatetimeAgg BETWEEN :start AND :end',
      expressionValues: util.dynamodb.toMapValues({
        ':controller': ctx.args.Controller,
        ':division': ctx.args.Division,
        ':start': ctx.args.StartDatetime,
        ':end': ctx.args.EndDatetime,
      }),
    },
    limit: 1000,
    scanIndexForward: true,
    nextToken: nextToken,
  };
}

export function response(ctx) {
  var items = [];
  var nextToken = null;

  if (ctx.result && ctx.result.items) {
    items = ctx.result.items;
  }

  if (ctx.result && ctx.result.nextToken) {
    nextToken = ctx.result.nextToken;
  }

  return {
    items: items,
    nextToken: nextToken,
  };
}
