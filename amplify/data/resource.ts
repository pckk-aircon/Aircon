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

  getPost: a
    .query()
    .arguments({
      Device: a.id().required(),
      Controller: a.string() // Controllerを追加
    })
    .returns(a.ref("Post"))
    .authorization(allow => [allow.publicApiKey()])
    .handler(
      a.handler.custom({
        dataSource: "DeviceDataSource",
        entry: "./getPost.js",
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
    .returns(a.ref("Post"))
    .authorization(allow => [allow.publicApiKey()])
    .handler(
      a.handler.custom({
        dataSource: "DeviceDataSource",
        entry: "./getPost.js",
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