/*
import { defineFunction } from '@aws-amplify/backend';

export const postConfirmation = defineFunction({
  name: 'post-confirmation',
});
*/


import { defineAuth } from '@aws-amplify/backend';

//import { postConfirmation } from './post-confirmation/resource';

//copilot案により修正。
import { defineFunction } from '@aws-amplify/backend';
export const postConfirmation = defineFunction({
  name: 'post-confirmation',
  entry: './handler.ts',
});



export const auth = defineAuth({
  loginWith: {
    email: true,
  },
  triggers: {
    postConfirmation
  }
});