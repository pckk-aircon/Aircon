/*
import { util } from '@aws-appsync/utils';

export function request(ctx) {
  const start = ctx.args.StartDatetime;
  const end = ctx.args.EndDatetime;
  const nextToken = ctx.args.nextToken ?? null;

  return {
    operation: 'Query',
    index: 'Controller-Division-DatetimeAgg-index',
    query: {
      expression:
        'Controller = :controller AND Division = :division AND DatetimeAgg BETWEEN :start AND :end',
      expressionValues: util.dynamodb.toMapValues({
        ':controller': ctx.args.Controller,
        ':division': ctx.args.Division,
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

  console.log('count:', ctx.result?.items?.length);
  console.log('nextToken:', ctx.result?.nextToken);

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
    index: 'Controller-Division-DatetimeAgg-index',

    query: {
      expression:
        'Controller = :controller AND Division = :division AND DatetimeAgg BETWEEN :start AND :end',
      expressionValues: util.dynamodb.toMapValues({
        ':controller': ctx.args.Controller,
        ':division': ctx.args.Division,
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

  console.log('[listIotAgg] count:', ctx.result?.items?.length);
  console.log('[listIotAgg] nextToken:', ctx.result?.nextToken);

  // ✅ デバッグ用（最初だけ残してOK）
  if (ctx.result?.items?.length) {
    console.log(
      '[listIotAgg] first item:',
      JSON.stringify(ctx.result.items[0], null, 2)
    );
  }

  return {
    items: ctx.result?.items ?? [],
    nextToken: ctx.result?.nextToken ?? null,
  };
}