import { util } from '@aws-appsync/utils';

export function request(ctx) {

    return {
        operation: 'Query',
        query: {
            //expression: 'Controller = :controller AND DeviceDatetime = :deviceDatetime',
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

//★↓以下を追加
export const response = (ctx) => {
    return ctx.result.items.map(item => ({
        Device: item.Device,
        DeviceDatetime: item.DeviceDatetime,
        Controller: item.Controller,
        DeviceType: item.DeviceType,//★新たに取得したいフィールド
        Division: item.Division,//★新たに取得したいフィールド
    }));

};