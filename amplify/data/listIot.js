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

export const response = (ctx) => {
    return ctx.result.items.map(item => ({
        Device: item.Device,
        DeviceDatetime: item.DeviceDatetime,
        Controller: item.Controller,
        DeviceType: item.DeviceType,
        Division: item.Division
    }));

};