import { util } from '@aws-appsync/utils';


export function request(ctx) {

    return {
        operation: 'Query',
        query: {
            //expression: 'Controller = :controller AND DeviceDatetime = :deviceDatetime',
            expression: 'Controller = :controller AND DeviceDatetime BETWEEN :startDatetime AND :endDatetime',

            //expressionValues: util.dynamodb.toMapValues({ 
                //':controller': ctx.args.Controller,
                //':deviceDatetime': ctx.args.DeviceDatetime
            //})

            expressionValues: util.dynamodb.toMapValues({ 
                ':controller': ctx.args.Controller,
                ':startDatetime': ctx.args.StartDatetime,
                ':endDatetime': ctx.args.EndDatetime
            })
        },
        index: 'Controller-DeviceDatetime-index'
    };

}

//export const response = (ctx) => ctx.result.items;

export const response = (ctx) => {
    // リクエストからフィールドの値を取得。
    const deviceType = ctx.args.DeviceType;
    const division = ctx.args.Division;
    const actualTemp = ctx.args.ActualTemp;
    const actualHumidity = ctx.args.ActualHumidity;
  
    return {
      ...ctx.result,
      DeviceType: deviceType,
      Division: division,
      ActualTemp: actualTemp,
      ActualHumidity: actualHumidity,
    };
  };