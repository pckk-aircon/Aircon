/*
import { defineFunction } from '@aws-amplify/backend';

export const postConfirmation = defineFunction({
  name: 'post-confirmation',
});
*/


import { defineAuth } from '@aws-amplify/backend';
import { postConfirmation } from './post-confirmation/resource';


export const auth = defineAuth({
  loginWith: {
    email: true,
  },
  triggers: {
    postConfirmation
  }
});