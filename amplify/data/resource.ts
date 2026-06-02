/*

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
    gltf: a.string(),
    direction: a.string(),
    height: a.string(),
    lat: a.string(),
    lon: a.string(),
    model: a.string(),
  }),

  // add
  addDevice: a
    .mutation()
    .arguments({
      Device: a.id(), // page.tsxでのエラーを防ぐため.required()をはずす。
      DeviceName: a.string(),
      Controller: a.string(),
      DeviceType: a.string(),
      Division: a.string(),
      gltf: a.string(),
      direction: a.string(),
      height: a.string(),
      lat: a.string(),
      lon: a.string(),
      model: a.string(),
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
      gltf: a.string(),
      direction: a.string(),
      height: a.string(),
      lat: a.string(),
      lon: a.string(),
      model: a.string(),
    })
    .returns(a.ref("Device").array())
    .authorization(allow => [allow.publicApiKey()])
    .handler(
      a.handler.custom({
        dataSource: "DeviceDataSource", // ★★★変更。
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
        entry: "./receivePost.js",
      })
    ),

  // ＊＊＊＊ Division ＊＊＊＊

  // データを設定。
  Division: a.customType({
    Division: a.id().required(),
    DivisionName: a.string(),
    Geojson: a.string(),
    Controller: a.string(),
  }),

  // add
  addDivision: a
    .mutation()
    .arguments({
      Division: a.id(), // page.tsxでのエラーを防ぐため.required()をはずす。
      DivisionName: a.string(),
      Geojson: a.string(),
      Controller: a.string(),
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
      Geojson: a.string(),
      Controller: a.string(),
    })
    .returns(a.ref("Division").array())
    .authorization(allow => [allow.publicApiKey()])
    .handler(
      a.handler.custom({
        dataSource: "DivisionDataSource", // ★★★変更。
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
        entry: "./receivePost.js",
      })
    ),

  // ＊＊＊＊ Iot ＊＊＊＊

  // データを設定。
  IotData: a.customType({
    Device: a.id().required(),
    DeviceDatetime: a.string(),
    DeviceType: a.string(),
    Controller: a.string(),
    ControlStage: a.string(),
    ControlMode: a.string(),
    Power: a.string(),
    WeightedTemp: a.string(),
    ReferenceTemp: a.string(),
    TargetTemp: a.string(),
    PresetTemp: a.string(),
    PanelSetTemp: a.string(),
    SetTemp: a.string(),
    SetTime: a.string(),
    ActualTemp: a.string(),
    ActualHumidity: a.string(),
    ApparentPower: a.string(),
    ActivePower: a.string(),
    CumulativeEnergy: a.string(),
    Division: a.string(),
  }),

  // ★追加：ページング用の返却型
  IotDataPage: a.customType({
    items: a.ref("IotData").array(),
    nextToken: a.string(),
  }),

  // list
  listIot: a
    .query()
    .arguments({
      Controller: a.string(),
      StartDatetime: a.string(),
      EndDatetime: a.string(),
      nextToken: a.string(), // ★追加
    })
    .returns(a.ref("IotDataPage")) // ★変更：配列ではなくページ型
    .authorization(allow => [allow.publicApiKey()])
    .handler(
      a.handler.custom({
        dataSource: "IotDataSource", // ★★★変更。
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
      expiresInDays: 365, // apikeyの有効期限を365日に設定。
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
    gltf: a.string(),
    direction: a.string(),
    height: a.string(),
    lat: a.string(),
    lon: a.string(),
    model: a.string(),
  }),

  // add
  addDevice: a
    .mutation()
    .arguments({
      Device: a.id(), // page.tsxでのエラーを防ぐため.required()をはずす。
      DeviceName: a.string(),
      Controller: a.string(),
      DeviceType: a.string(),
      Division: a.string(),
      gltf: a.string(),
      direction: a.string(),
      height: a.string(),
      lat: a.string(),
      lon: a.string(),
      model: a.string(),
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
      gltf: a.string(),
      direction: a.string(),
      height: a.string(),
      lat: a.string(),
      lon: a.string(),
      model: a.string(),
    })
    .returns(a.ref("Device").array())
    .authorization(allow => [allow.publicApiKey()])
    .handler(
      a.handler.custom({
        dataSource: "DeviceDataSource", // ★★★変更。
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
        entry: "./receivePost.js",
      })
    ),

  // ＊＊＊＊ Division ＊＊＊＊

  // データを設定。
  Division: a.customType({
    Division: a.id().required(),
    DivisionName: a.string(),
    Geojson: a.string(),
    Controller: a.string(),
  }),

  // add
  addDivision: a
    .mutation()
    .arguments({
      Division: a.id(), // page.tsxでのエラーを防ぐため.required()をはずす。
      DivisionName: a.string(),
      Geojson: a.string(),
      Controller: a.string(),
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
      Geojson: a.string(),
      Controller: a.string(),
    })
    .returns(a.ref("Division").array())
    .authorization(allow => [allow.publicApiKey()])
    .handler(
      a.handler.custom({
        dataSource: "DivisionDataSource", // ★★★変更。
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
        entry: "./receivePost.js",
      })
    ),

  // ＊＊＊＊ Iot ＊＊＊＊

  // データを設定。
  IotData: a.customType({
    Device: a.id().required(),
    DeviceDatetime: a.string(),
    DeviceType: a.string(),
    Controller: a.string(),
    ControlStage: a.string(),
    ControlMode: a.string(),
    Power: a.string(),
    WeightedTemp: a.string(),
    ReferenceTemp: a.string(),
    TargetTemp: a.string(),
    PresetTemp: a.string(),
    PanelSetTemp: a.string(),
    SetTemp: a.string(),
    SetTime: a.string(),
    ActualTemp: a.string(),
    ActualHumidity: a.string(),
    ApparentPower: a.string(),
    ActivePower: a.string(),
    CumulativeEnergy: a.string(),
    Division: a.string(),
  }),

  // ★追加：ページング用の返却型
  IotDataPage: a.customType({
    items: a.ref("IotData").array(),
    nextToken: a.string(),
  }),

  // list
  listIot: a
    .query()
    .arguments({
      Controller: a.string(),
      Division: a.string(),   // ★追加
      StartDatetime: a.string(),
      EndDatetime: a.string(),
      nextToken: a.string(), // ★追加
    })
    .returns(a.ref("IotDataPage")) // ★変更：配列ではなくページ型
    .authorization(allow => [allow.publicApiKey()])
    .handler(
      a.handler.custom({
        dataSource: "IotDataSource", // ★★★変更。
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
      expiresInDays: 365, // apikeyの有効期限を365日に設定。
    },
  },
});
