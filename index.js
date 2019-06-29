'use strict';

const express = require('express');

const co = require('co'); //coのライブラリのロード

const MongoClient = require('mongodb').MongoClient; //MongoDBにアクセスするためのクライアントを生成

const MONGODB_URI = process.env.MONGODB_URI; //Heroku上では，MONGODB_URIの環境変数にMongoDBのURIが設定される




const line = require('@line/bot-sdk');


// create LINE SDK config from env variables

const config = {

  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,

  channelSecret: process.env.CHANNEL_SECRET,

};



// create LINE SDK client

const client = new line.Client(config);



// create Express app

// about Express itself: https://expressjs.com/

const app = express();



// register a webhook handler with middleware

// about the middleware, please refer to doc

app.post('/webhook', line.middleware(config), (req, res) => {

  Promise

    .all(req.body.events.map(handleEvent))

    .then((result) => res.json(result));

});


const dbWriter = co.wrap(function* (event, item_name, item_price){

  let db = yield MongoClient.connect(MONGODB_URI);
  let logs = db.collection('logs'); // logsという名前のcollection (関係データベースのtableに相当する)を使う
  let userId = event.source.userId; // LINEのuser IDを取得する
  //let result = yield logs.findOneAndUpdate({userId: userId}, // {userId: ユーザID, count: 回数} の形式でデータを保持
  //    {$inc: {count: 1}},                                    // countの値をプラス 1 する
  //    {upsert: true, returnOriginal: false});                // userIdのデータがなければ，作成する．修正後のデータを返す
  let result = yield logs.insertOne({item: item_name, price: item_price});
  //let count = result.value ? result.value.count : 0;         // result.valueの値があれば，result.value.countの値をcountの値とする
  //return {type: 'text', text: '[' + count + '] ' + event.message.text};
  return  { type: 'text', text: '項目名 ' + item_name + ' ' + item_price + ' 円'};

});


const dbReader = co.wrap(function* (event){

  let db = yield MongoClient.connect(MONGODB_URI);
  let logs = db.collection('logs'); // logsという名前のcollection (関係データベースのtableに相当する)を使う
  let userId = event.source.userId; // LINEのuser IDを取得する
  //let result = yield logs.findOneAndUpdate({userId: userId}, // {userId: ユーザID, count: 回数} の形式でデータを保持
  //    {$inc: {count: 1}},                                    // countの値をプラス 1 する
  //    {upsert: true, returnOriginal: false});                // userIdのデータがなければ，作成する．修正後のデータを返す
  let result = yield logs.find().toArray();
  console.log(result);
  //let count = result.value ? result.value.count : 0;         // result.valueの値があれば，result.value.countの値をcountの値とする
  //return {type: 'text', text: '[' + count + '] ' + event.message.text};
  let text = '項目一覧:';
    for (let i = 0; i < result.length; i++) {
      text = text + '\n' + result[i].item + ' ' + result[i].price + ' 円';
    }
     
  return  {type: 'text', text: text};

});

let status = 'waiting';
let item_name = '';
let item_price = 0;

let item_list = [];

// event handler

function handleEvent(event) {

  if (event.type !== 'message' || event.message.type !== 'text') {

    // ignore non-text-message event

    return Promise.resolve(null);

  }

  let echo;
 
  if (status === 'input_item') {
     item_name = event.message.text;
     status = 'item_price';
     echo = { type: 'text', text: '値段を入力してください' };
     return client.replyMessage(event.replyToken, echo);
   } else if (status === 'item_price') {
     item_price = parseInt(event.message.text);
     status = 'waiting';
     // db write
     //
     return dbWriter(event, item_name, item_price).then((value) => client.replyMessage(event.replyToken, value));
     //item_list.push({item: item_name, price: item_price});
    // echo = { type: 'text', text: '項目名 ' + item_name + ' ' + item_price + ' 円'}
     
     //return client.replyMessage(event.replyToken, echo);
  }

  let command = event.message.text;

  if (command === '入力') {
     status = 'input_item';
     item_name = '';
     item_price = 0;
     echo = { type: 'text', text: '項目名を入力してください' };
     return client.replyMessage(event.replyToken, echo);
  } else if (command === '一覧') {
     // db access and get a list of items
    // let text = '項目一覧:';
    // for (let i = 0; i < item_list.length; i++) {
    //   text = text + '\n' + item_list[i].item + ' ' + item_list[i].price + ' 円';
     //}
     
    // echo = { type: 'text', text: text};
    //return client.replyMessage(event.replyToken, echo);
    return dbReader(event).then((value) => client.replyMessage(event.replyToken, value));
  } else {
     echo = { type: 'text', text: '分かりません'};
     return client.replyMessage(event.replyToken, echo);

  }
   

 //  return Promise.resolve(dbHandler(event))  // dbHandlerを呼び出した結果がpromiseでもvalueでもいいようにPromise.resolveを使っている
 //   .then((value) => {
       return client.replyMessage(event.replyToken, value); // client.replyMessageはPromiseを返す．
 //   });


  // create a echoing text message

  //const echo = { type: 'text', text: event.message.text };



  // use reply API

  //return client.replyMessage(event.replyToken, echo);

}



// listen on port

const port = process.env.PORT || 3000;

app.listen(port, () => {

  console.log(`listening on ${port}`);

});