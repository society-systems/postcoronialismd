import nacl from "tweetnacl";
import { Database } from "better-sqlite3";
import { init } from "./db";
import { ConstraintError, DuplicateEntity, Unauthorized } from "./errors";
import { sha256, uint8ArrayToHexString } from "./f";
import {
  createSpace,
  hasSpace,
  invite,
  join,
  sqlGetSpace,
  sqlInsertSpace,
} from "./spaces";
import { getSpaceByUser, getUser, sqlGetSpaceByUser } from "./users";
import {
  addPost,
  deletePost,
  editPost,
  getPost,
  getPosts,
  markPostAsSeen,
  markPostAsUnseen,
} from "./forum";

describe("SQL constraints for Spaces", () => {
  function ts(seconds = 0) {
    const now = new Date();
    return Math.round(now.setSeconds(now.getSeconds() + seconds) / 1000);
  }

  function setPostTs(id: string, seconds = 0) {
    const s = ts(seconds);
    db.prepare("UPDATE posts SET ts=$ts WHERE id = $id").run({
      id,
      ts: s,
    });
    return s;
  }

  function setSeenTs(publicKey: Uint8Array, postId: string, seconds = 0) {
    const s = ts(seconds);
    db.prepare(
      "UPDATE posts SET ts=$ts WHERE publicKey = $publicKey AND postId = $postId"
    ).run({
      publicKey: uint8ArrayToHexString(publicKey),
      ts: ts(seconds),
    });
  }

  let db: Database;
  const princessBubblegum = nacl.sign.keyPair();
  const finn = nacl.sign.keyPair();
  const jake = nacl.sign.keyPair();
  const iceKing = nacl.sign.keyPair();

  beforeEach(() => {
    db = init();
    createSpace(
      db,
      princessBubblegum.publicKey,
      "Candy Kingdom",
      "Princess Bubblegum"
    );
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + 7);
    const finnInvite = invite(princessBubblegum.secretKey, false, expiry);
    const jakeInvite = invite(princessBubblegum.secretKey, false, expiry);
    join(db, finn.publicKey, "Finn", finnInvite);
    join(db, jake.publicKey, "Jake", jakeInvite);
  });

  test("Create a post", () => {
    const postId = addPost(db, finn.publicKey, "", "title", "body");
    const postTs = setPostTs(postId, -10);
    const replyId = addPost(
      db,
      jake.publicKey,
      postId,
      "reply title",
      "reply body"
    );
    const replyTs = setPostTs(replyId, -9);
    const replyId2 = addPost(
      db,
      finn.publicKey,
      postId,
      "reply title 2",
      "reply body 2"
    );
    const replyTs2 = setPostTs(replyId2, -8);
    const posts = getPosts(db, finn.publicKey, "", 10, 0);
    expect(posts).toEqual([
      {
        id: postId,
        title: "title",
        body: "body",
        publicKey: uint8ArrayToHexString(finn.publicKey),
        name: "Finn",
        lastTs: replyTs2,
        ts: postTs,
        seen: null,
        seenTs: null,
        parentId: "",
      },
    ]);
    const replies = getPosts(db, finn.publicKey, postId, 10, 0);
    expect(replies).toEqual([
      {
        id: replyId,
        title: "reply title",
        body: "reply body",
        publicKey: uint8ArrayToHexString(jake.publicKey),
        name: "Jake",
        ts: replyTs,
        lastTs: replyTs,
        seen: null,
        seenTs: null,
        parentId: postId,
      },
      {
        id: replyId2,
        title: "reply title 2",
        body: "reply body 2",
        publicKey: uint8ArrayToHexString(finn.publicKey),
        name: "Finn",
        ts: replyTs2,
        lastTs: replyTs2,
        seen: null,
        seenTs: null,
        parentId: postId,
      },
    ]);
    expect(() => getPosts(db, iceKing.publicKey, "", 10, 0)).toThrow(
      Unauthorized
    );
    expect(() => getPost(db, iceKing.publicKey, postId)).toThrow(Unauthorized);
  });

  test("Edit a post", () => {
    const postId = addPost(db, finn.publicKey, "", "title", "body");
    const post = getPost(db, finn.publicKey, postId);
    expect(post).toMatchObject({
      id: postId,
      title: "title",
      body: "body",
      publicKey: uint8ArrayToHexString(finn.publicKey),
      name: "Finn",
      seenTs: null,
      parentId: "",
    });
    const editedPost = editPost(db, finn.publicKey, postId, "title2", "body2");
    expect(editedPost).toMatchObject({
      id: postId,
      title: "title2",
      body: "body2",
      publicKey: uint8ArrayToHexString(finn.publicKey),
      name: "Finn",
      seenTs: null,
      parentId: "",
    });
    editPost(db, finn.publicKey, postId, "title3", "body3");
    const editedPost2 = getPost(db, finn.publicKey, postId);
    expect(editedPost2).toMatchObject({
      id: postId,
      title: "title3",
      body: "body3",
      publicKey: uint8ArrayToHexString(finn.publicKey),
      name: "Finn",
      seenTs: null,
      parentId: "",
    });
  });
  test("Another user cannot edit a post", () => {
    const postId = addPost(db, finn.publicKey, "", "title", "body");
    expect(() =>
      editPost(db, jake.publicKey, postId, "jake title", "jake body")
    ).toThrow(Unauthorized);
    expect(() =>
      editPost(db, iceKing.publicKey, postId, "ice title", "ice body")
    ).toThrow(Unauthorized);
  });
  test("Mark a post as seen/unseen", () => {
    const postId = addPost(db, finn.publicKey, "", "title", "body");
    let post = getPost(db, finn.publicKey, postId);
    expect(post.seenTs).toBeNull();
    markPostAsSeen(db, finn.publicKey, postId);
    post = getPost(db, finn.publicKey, postId);
    expect(post.seenTs).toBeDefined();
    markPostAsUnseen(db, finn.publicKey, postId);
    post = getPost(db, finn.publicKey, postId);
    expect(post.seenTs).toBeNull();
  });
  test("Retrieve posts in the correct order", () => {
    const postId = addPost(db, finn.publicKey, "", "title", "body");
    const postTs = setPostTs(postId, -100);
    const replyId = addPost(
      db,
      jake.publicKey,
      postId,
      "reply title",
      "reply body"
    );
    const replyTs = setPostTs(replyId, -90);
    const replyId2 = addPost(
      db,
      finn.publicKey,
      postId,
      "reply title 2",
      "reply body 2"
    );
    const replyTs2 = setPostTs(replyId2, -80);
    const postId2 = addPost(db, jake.publicKey, "", "jake", "teh dog");
    const postTs2 = setPostTs(postId2, -50);
    markPostAsSeen(db, finn.publicKey, postId);
    let posts = getPosts(db, finn.publicKey, "", 10, 0);
    expect(posts.map(({ id }) => id)).toEqual([postId2, postId]);
    const replyId3 = addPost(
      db,
      finn.publicKey,
      postId,
      "reply title 3",
      "reply body 3"
    );
    const replyTs3 = setPostTs(replyId3, -40);
    posts = getPosts(db, finn.publicKey, "", 10, 0);
    expect(posts.map(({ id }) => id)).toEqual([postId, postId2]);
    let replies = getPosts(db, finn.publicKey, postId, 10, 0);
    expect(replies.map(({ id }) => id)).toEqual([replyId, replyId2, replyId3]);
  });
  /*
  test("Return all posts without a parent", () => {
    const controversialId = addPost(db, finn.publicKey, null, "something controversial", "compelling narrative");
    const burritoId = addPost(db, jake.publicKey, null, "best burrito", "is everything burrito");
    const replyControversialId = addPost(
      db,
      jake.publicKey,
      controversialId,
      "why you are wrong",
      "convincing argument"
    );
    const replyBurritoId = addPost(
      db,
      finn.publicKey,
      controversialId,
      "pizza",
      "pizza is the best"
    );
    deletePost(db, finn.publicKey, controversialId);
    const posts = getPosts(db, finn.publicKey, null, 10, 0);
    expect(posts).toMatchObject([ 
      {
        id: replyControversialId,
        title: "why you are wrong",
        body: "reply body",
        publicKey: uint8ArrayToHexString(jake.publicKey),
        name: "Jake",
        seenTs: null,
        parentId: postId,
      },
      {
        id: replyId2,
        title: "reply title 2",
        body: "reply body 2",
        publicKey: uint8ArrayToHexString(finn.publicKey),
        name: "Finn",
        seenTs: null,
        parentId: postId,
      },
    ]);
  });
*/
  test("Delete on cascade cleans up everything", () => {
    const postId = addPost(db, finn.publicKey, "", "title", "body");
    const replyId = addPost(
      db,
      jake.publicKey,
      postId,
      "reply title",
      "reply body"
    );
    const replyId2 = addPost(
      db,
      finn.publicKey,
      postId,
      "reply title 2",
      "reply body 2"
    );
    markPostAsSeen(db, finn.publicKey, postId);
    markPostAsSeen(db, jake.publicKey, postId);
    expect(db.prepare("SELECT COUNT(*) AS total FROM seen").get()).toEqual({
      total: 2,
    });
    expect(() => deletePost(db, iceKing.publicKey, postId)).toThrow(
      Unauthorized
    );
    expect(() => deletePost(db, jake.publicKey, postId)).toThrow(Unauthorized);
    deletePost(db, finn.publicKey, postId);
    expect(() => markPostAsSeen(db, finn.publicKey, postId)).toThrow(
      Unauthorized
    );
    expect(getPost(db, finn.publicKey, postId)).toBeUndefined();
    expect(db.prepare("SELECT COUNT(*) AS total FROM seen").get()).toEqual({
      total: 0,
    });
  });
});
