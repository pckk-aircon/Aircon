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

*/

import { util } from '@aws-appsync/utils';

export function request(ctx) {
  const nextToken = ctx.args.nextToken ?? null;

  // ✅ Division + Datetime を連結して SortKey として使う
  const startKey = `${ctx.args.Division}#${ctx.args.StartDatetime}`;
  const endKey = `${ctx.args.Division}#${ctx.args.EndDatetime}`;

  return {
    operation: 'Query',
    index: 'Controller-Division-DatetimeAgg-index',

    query: {
      // ✅ SortKey（Division-DatetimeAgg）を1つとして扱う
      expression:
        'Controller = :controller AND #sk BETWEEN :start AND :end',

      expressionNames: {
        '#sk': 'Division-DatetimeAgg',
      },

      expressionValues: util.dynamodb.toMapValues({
        ':controller': ctx.args.Controller,
        ':start': startKey,
        ':end': endKey,
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

  const items = ctx.result?.items ?? [];

  console.log('[listIotAgg] count:', items.length);
  console.log('[listIotAgg] nextToken:', ctx.result?.nextToken);

  // ✅ デバッグ（最初の1件）
  if (items.length > 0) {
    console.log(
      '[listIotAgg] first raw item:',
      JSON.stringify(items[0], null, 2)
    );
  }

  return {
    items,
    nextToken: ctx.result?.nextToken ?? null,
  };
}
