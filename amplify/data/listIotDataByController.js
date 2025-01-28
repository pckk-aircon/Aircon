//新しいテーブル（IoTData）の設定を追加
console.log('listIotDataByController called'); // ファイルが呼び出されたことを確認

import { util } from '@aws-appsync/utils';

export function request(ctx) {

    console.log('Request context:', ctx); // Check the context object
    //console.log('Controller:', ctx.args.Controller); // Check the Controller argument
    console.log('DeviceDatetime:', ctx.args.DeviceDatetime); // Check the DeviceDatetime

    return {

        operation: 'Query',
        query: {
 
            //expression: 'Controller = :controller',
            expression: 'Controller = :controller AND DeviceDatetime = :deviceDatetime',

            //expressionValues: util.dynamodb.toMapValues({ ':controller': ctx.args.Controller })
            expressionValues: util.dynamodb.toMapValues({ 
                ':controller': ctx.args.Controller,
                ':deviceDatetime': ctx.args.DeviceDatetime
            })

        },
        index: 'Controller-DeviceDatetime-index'

    };
}

export const response = (ctx) => ctx.result.items;