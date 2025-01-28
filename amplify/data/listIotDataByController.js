//新しいテーブル（IoTData）の設定を追加
console.log('listIotDataByController called'); // ファイルが呼び出されたことを確認

import { util } from '@aws-appsync/utils';

export function request(ctx) {

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

//export const response = (ctx) => ctx.result.items;
export const response = (ctx) => {
    console.log('Response context:', ctx); // レスポンスコンテキストを確認
    console.log('Result items:', ctx.result.items); // 結果のアイテムを確認
    return ctx.result.items;
};