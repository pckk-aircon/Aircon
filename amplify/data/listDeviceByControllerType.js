
//listDeviceByController.jsを改変。
//グローバルセカンダリインデックスが連結の場合

import { util } from '@aws-appsync/utils';

console.log('ControllerType-handrar called'); // 関数が呼び出されたことを確認

export function request(ctx) {
    return {
    operation: 'Query',
    query: {
      //expression: 'Controller = :controller',
      expression: 'Controller = :controller AND DeviceType = :deviceType',
      //expressionValues: util.dynamodb.toMapValues({ ':controller': ctx.args.Controller })
      expressionValues: util.dynamodb.toMapValues({ 
        ':controller': ctx.args.Controller,
        ':deviceType': ctx.args.DeviceType
      })
    },
    //index: 'Controller-index'
    index: Controller-DeviceType-index
  };
}
export const response = (ctx) => ctx.result.items;