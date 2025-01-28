
//listDeviceByController.jsを改変。
//グローバルセカンダリインデックスが連結の場合

import { util } from '@aws-appsync/utils';

console.log('ControllerType-handrar called'); // 関数が呼び出されたことを確認

export function request(ctx) {
    return {
    operation: 'Query',
    query: {
      expression: 'Controller = :controller',
      expressionValues: util.dynamodb.toMapValues({ ':controller': ctx.args.Controller })
    },
    index: 'Controller-index'
  };
}
export const response = (ctx) => ctx.result.items;