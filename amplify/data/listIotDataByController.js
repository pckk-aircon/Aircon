//新しいテーブル（IoTData）の設定を追加

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

export const response = (ctx) => ctx.result.items;