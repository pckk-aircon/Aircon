import { type ClientSchema, a, defineData } from "@aws-amplify/backend";

/*== STEP 1 ===============================================================
The section below creates a Todo database table with a "content" field. Try
adding a new "isDone" field as a boolean. The authorization rule below
specifies that any user authenticated via an API key can "create", "read",
"update", and "delete" any "Todo" records.
=========================================================================*/
const schema = a.schema({
  Todo: a
    .model({
      content: a.string(),
    })
    .authorization((allow) => [allow.publicApiKey()]),

  //step1にて追加。
  Post: a.customType({
    Device: a.id().required(),
    DeviceDatetime: a.string(),
    Controller: a.string(),
  }),


  //新しいテーブル（IoTData）の設定を追加
  IotData: a.customType({
    Device: a.id().required(),
    DeviceDatetime: a.string(),
    Controller: a.string(),
    ControlStage: a.string(),
    ReferenceTemp: a.string(), 
    TargetTemp: a.string(),
    PresetTemp: a.string(),
    ActualTemp: a.string(),
    ActualHumidity: a.string(),
    DeviceType: a.string(),
    Division: a.string(), 
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
        dataSource: "ExternalPostTableDataSource",
        entry: "./addPost.js",
      })
    ),

  getPost: a
    .query()
    .arguments({
      Device: a.id().required(),
      //Controller: a.string() // Controllerを追加
    })
    .returns(a.ref("Post"))
    .authorization(allow => [allow.publicApiKey()])
    .handler(
      a.handler.custom({
        dataSource: "ExternalPostTableDataSource",
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

  listIot: a
    .query()
    .arguments({
      Controller: a.string(),
      DeviceDatetime: a.string(),
      StartDatetime: a.string(),//範囲検索のため追加。
      EndDatetime: a.string(),//範囲検索のため追加。
    })
    .returns(a.ref("IotData").array())//結果は複数件レスポンスされる可能性があるので配列形式とする。
    .authorization(allow => [allow.publicApiKey()])
    .handler(
      a.handler.custom({
        dataSource: "ExternalPostTableDataSource",
        entry: "./listIot.js",

      })
    ),

  getList: a
    .mutation()
    .arguments({
      //Device: a.id(),//page.tsxでのエラーを防ぐため.required()をはずす。
      Controller: a.string(),
      DeviceDatetime: a.string(),
    })
    .returns(a.ref("IotData"))
    .authorization(allow => [allow.publicApiKey()])
    .handler(
      a.handler.custom({
        dataSource: "ExternalPostTableDataSource",
        entry: "./getList.js",
      })
    ),

  //カスタムサブスクリプションを実装
  receivelistIot: a
    .subscription()
    .for(a.ref("getList")) 
    .authorization(allow => [allow.publicApiKey()])
    .handler(
        a.handler.custom({
            entry: './receivelistIot.js'
        })
    ),


  //新しいテーブル（DeviceTableDeviceTable）の設定を追加
  listIotDataByController: a
    .query()
    .arguments({
      Controller: a.string(),
      DeviceDatetime: a.string(),
    })
    .returns(a.ref("IotData").array())
    .authorization(allow => [allow.publicApiKey()])
    .handler(
      a.handler.custom({
        dataSource: "DeviceDataSource",//★★★
        //dataSource: "ExternalPostTableDataSource",      
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