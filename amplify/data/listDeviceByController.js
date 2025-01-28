
//2025.1.23サポート様より提示。
//グローバルセカンダリインデックスを利用したQuery（リゾルバーの関数の内容を修正）を実行
//参考チュートリアル↓
//https://docs.amplify.aws/nextjs/build-a-backend/data/connect-to-existing-data-sources/connect-external-ddb-table/#query

import { util } from '@aws-appsync/utils';

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