//新しいテーブル（IoTData）の設定を追加

import { util } from '@aws-appsync/utils';

export function request(ctx) {
    return {
    operation: 'Query',
    query: {
      expression: 'Controller = :controller',
      expressionValues: util.dynamodb.toMapValues({ ':controller': ctx.args.Controller })
    },
    index: 'Controller-DeviceDatetime-index'
  };
}
export const response = (ctx) => ctx.result.items;