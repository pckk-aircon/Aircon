/*

import { type ClientSchema, a, defineData } from "@aws-amplify/backend";

const schema = a.schema({

  //Deviceのデータを設定。
  Post: a.customType({
    Device: a.id().required(),
    Controller: a.string(),
  }),

  //step3にて追加。
  addPost: a
    .mutation()
    .arguments({
      Device: a.id(),//page.tsxでのエラーを防ぐため.required()をはずす。
      Controller: a.string()
    })
    .returns(a.ref("Post"))
    .authorization(allow => [allow.publicApiKey()])
    .handler(
      a.handler.custom({
        dataSource: "DeviceDataSource",
        entry: "./addPost.js",
      })
    ),

    listDevice: a
    .query()
    .arguments({
      Controller: a.string(),
    })
    .returns(a.ref("Post").array())
    .authorization(allow => [allow.publicApiKey()])
    .handler(
      a.handler.custom({
        //dataSource: "ExternalPostTableDataSource",
        dataSource: "DeviceDataSource",//★★★変更。
        entry: "./listDeviceByController.js",
      })
    ),

  //カスタムサブスクリプションを実装
  receivePost: a
    .subscription()
    .for(a.ref("addPost")) 
    .authorization(allow => [allow.publicApiKey()])
    .handler(
        a.handler.custom({
            entry: './receivePost.js'
        })
    ),


  //＊＊＊＊ listIot ＊＊＊＊

  //IoTのデータを設定
  IotData: a.customType({
    Device: a.id().required(),
    DeviceDatetime: a.string(),
    Controller: a.string(),
    ControlStage: a.string(),
    Power: a.string(),
    WeightedTemp: a.string(),
    ReferenceTemp: a.string(), 
    TargetTemp: a.string(),
    PresetTemp: a.string(),
    ActualTemp: a.string(),
    ActualHumidity: a.string(),
    DeviceType: a.string(),
    Division: a.string(), 
  }),

  // listIot（キー部分とキー以外のフィールドを一度に読み込み）
  listIot: a
    .query()
    .arguments({
      Controller: a.string(),
      StartDatetime: a.string(),
      EndDatetime: a.string(),
    })
    .returns(a.ref("IotData").array())
    .authorization(allow => [allow.publicApiKey()])
    .handler(
      a.handler.custom({
        //dataSource: "ExternalPostTableDataSource",
        dataSource: "IotSource",//★★★変更。
        entry: "./listIot.js",
      })
    ),

});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: "apiKey",
    apiKeyAuthorizationMode: {
      expiresInDays: 30,
    },
  },
});

*/

import { type ClientSchema, a, defineData } from "@aws-amplify/backend";

const schema = a.schema({

 // ＊＊＊＊ Device ＊＊＊＊

  // データを設定。
  Device: a.customType({
    Device: a.id().required(),
    DeviceName: a.string(),
    Controller: a.string(),
    DeviceType: a.string(),
    Division: a.string(),
  }),

  // add
  addDevice: a
    .mutation()
    .arguments({
      Device: a.id(),//page.tsxでのエラーを防ぐため.required()をはずす。
      DeviceName: a.string(),
      Controller: a.string(),
      DeviceType: a.string(),
      Division: a.string(),
    })
    .returns(a.ref("Device"))
    .authorization(allow => [allow.publicApiKey()])
    .handler(
      a.handler.custom({
        dataSource: "DeviceDataSource",
        entry: "./addDevice.js",
      })
    ),

  // list
  listDevice: a
  .query()
  .arguments({
    Device: a.id(),
    DeviceName: a.string(),
    Controller: a.string(),
    DeviceType: a.string(),
    Division: a.string(),
  })
  .returns(a.ref("Device").array())
  .authorization(allow => [allow.publicApiKey()])
  .handler(
    a.handler.custom({
      dataSource: "DeviceDataSource",//★★★変更。
      entry: "./listPostByController.js",
    })
  ),

  // カスタムサブスクリプション
  receiveDevice: a
    .subscription()
    .for(a.ref("addDevice")) 
    .authorization(allow => [allow.publicApiKey()])
    .handler(
        a.handler.custom({
            entry: './receivePost.js'
        })
    ),

 // ＊＊＊＊ Division ＊＊＊＊

  // データを設定。
  Division: a.customType({
    Division: a.id().required(),
    DivisionName: a.string(),
    DivisionGeojson: a.string(),
    GeojsonUrl: a.string(),
    Controller: a.string(),
  }),

  // add
  addDivision: a
    .mutation()
    .arguments({
      Division: a.id(),//page.tsxでのエラーを防ぐため.required()をはずす。
      DivisionName: a.string(),
      DivisionGeojson: a.string(),
      GeojsonUrl: a.string(),
      Controller: a.string()
    })
    .returns(a.ref("Division"))
    .authorization(allow => [allow.publicApiKey()])
    .handler(
      a.handler.custom({
        dataSource: "DivisionDataSource",
        entry: "./addDivision.js",
      })
    ),

  // list
  listDivision: a
  .query()
  .arguments({
    Division: a.id(),
    DivisionName: a.string(),
    DivisionGeojson: a.string(),
    GeojsonUrl: a.string(),
    Controller: a.string(),
  })
  .returns(a.ref("Division").array())
  .authorization(allow => [allow.publicApiKey()])
  .handler(
    a.handler.custom({
      dataSource: "DivisionDataSource",//★★★変更。
      entry: "./listPostByController.js",
    })
  ),


  // カスタムサブスクリプション
  receiveDivision: a
    .subscription()
    .for(a.ref("addDivision")) 
    .authorization(allow => [allow.publicApiKey()])
    .handler(
        a.handler.custom({
            entry: './receivePost.js'
        })
    ),
 
 
  // ＊＊＊＊ Iot ＊＊＊＊

  // データを設定。
  IotData: a.customType({
    Device: a.id().required(),
    DeviceDatetime: a.string(),
    Controller: a.string(),
    ControlStage: a.string(),
    Power: a.string(),
    WeightedTemp: a.string(),
    ReferenceTemp: a.string(), 
    TargetTemp: a.string(),
    PresetTemp: a.string(),
    ActualTemp: a.string(),
    ActualHumidity: a.string(),
    DeviceType: a.string(),
    Division: a.string(), 
  }),

  // list
  listIot: a
    .query()
    .arguments({
      Controller: a.string(),
      StartDatetime: a.string(),
      EndDatetime: a.string(),
    })
    .returns(a.ref("IotData").array())
    .authorization(allow => [allow.publicApiKey()])
    .handler(
      a.handler.custom({
        //dataSource: "ExternalPostTableDataSource",
        dataSource: "IotDataSource",//★★★変更。
        entry: "./listIot.js",
      })
    ),

});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: "apiKey",
    apiKeyAuthorizationMode: {
      expiresInDays: 30,
    },
  },
});