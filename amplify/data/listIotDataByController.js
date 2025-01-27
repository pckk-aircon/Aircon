//新しいテーブル（IoTData）の設定を追加

import { util } from '@aws-appsync/utils';

export function request(ctx) {
    console.log('handrar called'); // 関数が呼び出されたことを確認
    return {

        operation: 'Query',
        query: {
            //expression: 'Controller = :controller AND DeviceDatetime = :deviceDatetime',
            expression: 'Controller = :controller',
            //expressionValues: util.dynamodb.toMapValues({ 
                //':controller': ctx.args.Controller,
                //':deviceDatetime': ctx.args.DeviceDatetime
            //})
            expressionValues: util.dynamodb.toMapValues({ ':controller': ctx.args.Controller })
        },
        //index: 'Controller-DeviceDatetime-index'
        index: 'Controller-index'
    };
}

export const response = (ctx) => ctx.result.items;