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
    Controller: a.string(),
    DeviceType: a.string(),//追加（セカンダリーキーにも使用）。
  }),

  //新しいテーブル（IoTData）の設定を追加
  IotData: a.customType({
    Device: a.id().required(),
    DeviceDatetime: a.string(),
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
        dataSource: "ExternalPostTableDataSource",
        entry: "./addPost.js",
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

  //2025.1.23サポート様より提示。
  //Query の結果は複数件レスポンスされる可能性があるので、".returns(a.ref("Post").array())" のように
  //配列をレスポンスするスキーマを追加
  listDeviceByController: a
    .query()
    .arguments({
      Controller: a.string(),
      DeviceType: a.string(),//DeviceTypeを追加。
    })
    .returns(a.ref("Post").array())
    .authorization(allow => [allow.publicApiKey()])
    .handler(
      a.handler.custom({
        dataSource: "ExternalPostTableDataSource",
        //entry: "./listDeviceByController.js",
        entry: "./listDeviceByControllerType.js",
      })
    ),

  //新しいテーブル（IoTData）の設定を追加
  listIotDataByController: a

    .query()
    .arguments({
      Controller: a.string(),
      DeviceDatetime: a.string(), // DeviceDatetimeを追加
    })
    .returns(a.ref("IotData").array())
    .authorization(allow => [allow.publicApiKey()])
    .handler(
      a.handler.custom({
        dataSource: "IotDataTableDataSource",
        entry: "./listIotDataByController.js",
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


/*== STEP 2 ===============================================================
Go to your frontend source code. From your client-side code, generate a
Data client to make CRUDL requests to your table. (THIS SNIPPET WILL ONLY
WORK IN THE FRONTEND CODE FILE.)

Using JavaScript or Next.js React Server Components, Middleware, Server 
Actions or Pages Router? Review how to generate Data clients for those use
cases: https://docs.amplify.aws/gen2/build-a-backend/data/connect-to-API/
=========================================================================*/

/*
"use client"
import { generateClient } from "aws-amplify/data";
import type { Schema } from "@/amplify/data/resource";

const client = generateClient<Schema>() // use this Data client for CRUDL requests
*/

/*== STEP 3 ===============================================================
Fetch records from the database and use them in your frontend component.
(THIS SNIPPET WILL ONLY WORK IN THE FRONTEND CODE FILE.)
=========================================================================*/

/* For example, in a React component, you can use this snippet in your
  function's RETURN statement */
// const { data: todos } = await client.models.Todo.list()

// return <ul>{todos.map(todo => <li key={todo.id}>{todo.content}</li>)}</ul>