import { IContext } from "../context";
import { PsstError } from "../errors";
import { hexStringToUint8Array, uint8ArrayToHexString } from "../f";
import { getSecret, setSecret } from "../secrets";
import { createSpace, hasSpace, join, verifyInvite } from "../spaces";
import { getSpaceByUser, getInviteDetails } from "../users";
import {
  addPost,
  editPost,
  deletePost,
  getPost,
  getPosts,
  markPostAsSeen,
  markPostAsUnseen,
} from "../forum";
import { IRPCContext } from "./jsonrpc";
import { addSubscription, getVapidPublicKey } from "../subscriptions";

function callbackify(f: any) {
  return (args: any, context: IRPCContext, callback: any) => {
    try {
      const r = f(context.user, ...args);
      callback(null, r);
    } catch (error) {
      if (error instanceof PsstError) {
        callback({
          code: error.code,
          message: error.toString(),
        });
      } else {
        throw error;
      }
    }
  };
}

export default function rpc(context: IContext) {
  const { db } = context;

  function rpcJoinSpace(user: string, name: string, invite: string) {
    return join(
      db,
      hexStringToUint8Array(user),
      name,
      hexStringToUint8Array(invite)
    );
  }

  function rpcVerifyInvite(_: string, invite: string) {
    verifyInvite(db, hexStringToUint8Array(invite));
    return true;
  }

  function rpcGetSpace(user: string) {
    return getSpaceByUser(db, hexStringToUint8Array(user));
  }

  function rpcGetInviteDetails(_: string, user: string) {
    return getInviteDetails(db, hexStringToUint8Array(user));
  }

  function rpcHasSpace(_: string, spaceName: string) {
    return hasSpace(db, spaceName);
  }

  function rpcCreateSpace(user: string, spaceName: string, userName: string) {
    return createSpace(db, hexStringToUint8Array(user), spaceName, userName);
  }

  function rpcGetSecret(user: string) {
    const record = getSecret(db, hexStringToUint8Array(user));
    // FIXME: I think this should be moved to the getSecret func
    if (record) {
      return {
        value: uint8ArrayToHexString(record.value),
        nonce: uint8ArrayToHexString(record.nonce),
      };
    }
    return null;
  }

  function rpcSetSecret(user: string, value: string, nonce: string) {
    return setSecret(
      db,
      hexStringToUint8Array(user),
      hexStringToUint8Array(value),
      hexStringToUint8Array(nonce)
    );
  }

  function rpcAddPost(
    user: string,
    parentId: string,
    title: string,
    body: string
  ) {
    return addPost(db, hexStringToUint8Array(user), parentId, title, body);
  }

  function rpcEditPost(user: string, id: string, title: string, body: string) {
    return editPost(db, hexStringToUint8Array(user), id, title, body);
  }

  function rpcDeletePost(user: string, id: string) {
    return deletePost(db, hexStringToUint8Array(user), id);
  }

  function rpcGetPost(user: string, id: string) {
    return getPost(db, hexStringToUint8Array(user), id);
  }

  function rpcMarkPostAsSeen(user: string, id: string) {
    return markPostAsSeen(db, hexStringToUint8Array(user), id);
  }

  function rpcMarkPostAsUnseen(user: string, id: string) {
    return markPostAsUnseen(db, hexStringToUint8Array(user), id);
  }

  function rpcGetPosts(
    user: string,
    parentId: string,
    limit: number,
    offset: number
  ) {
    return getPosts(db, hexStringToUint8Array(user), parentId, limit, offset);
  }

  function rpcGetVapidPublicKey() {
    return getVapidPublicKey();
  }

  function rpcAddSubscription(user: string, subscription: string) {
    return addSubscription(db, hexStringToUint8Array(user), subscription);
  }

  return {
    joinSpace: callbackify(rpcJoinSpace),
    getSpace: callbackify(rpcGetSpace),
    verifyInvite: callbackify(rpcVerifyInvite),
    getInviteDetails: callbackify(rpcGetInviteDetails),
    hasSpace: callbackify(rpcHasSpace),
    createSpace: callbackify(rpcCreateSpace),
    getSecret: callbackify(rpcGetSecret),
    setSecret: callbackify(rpcSetSecret),
    addPost: callbackify(rpcAddPost),
    editPost: callbackify(rpcEditPost),
    deletePost: callbackify(rpcDeletePost),
    getPost: callbackify(rpcGetPost),
    markPostAsSeen: callbackify(rpcMarkPostAsSeen),
    markPostAsUnseen: callbackify(rpcMarkPostAsUnseen),
    getPosts: callbackify(rpcGetPosts),
    getVapidPublicKey: callbackify(rpcGetVapidPublicKey),
    addSubscription: callbackify(rpcAddSubscription),
  };
}
