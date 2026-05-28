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
    index: 'Controller-DeviceDatetime-index'
  };
}

export const response = (ctx) => ctx.result.items;

*/

/*
//NG
export function request(ctx) {
  return {
    operation: 'Query',
    query: {
      expression: 'Controller = :controller AND DeviceDatetime >= :startDatetime AND DeviceDatetime <= :endDatetime',
      expressionValues: util.dynamodb.toMapValues({ 
        ':controller': ctx.args.Controller,
        ':startDatetime': ctx.args.StartDatetime,
        ':endDatetime': ctx.args.EndDatetime
      })
    },
    index: 'Controller-DeviceDatetime-index'
  };
}
*/

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


