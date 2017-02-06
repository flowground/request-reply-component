"use strict";
const Q = require("q");
const debug = require('debug')('request-reply');

const HEADER_CONTENT_TYPE = 'Content-Type';
const DEFAULT_CONTENT_TYPE = 'application/json';

exports.process = function (msg) {
    const replyTo = msg.headers.reply_to;

    console.log(`Received new message, replyTo=${replyTo}`);
    debug('Received new message:%j', msg);

    let contentType;
    let responseBody;

    const self = this;


    Q()
        .then(init)
        .then(emitReply)
        .then(emitData)
        .fail(onError)
        .finally(onEnd);

    function init() {
        contentType = getContentType();
        if (!msg.body.responseBody) {
            debug('Field responseBody on the message body was empty, we will reply with the whole message body');
        }
        responseBody = msg.body.responseBody? msg.body.responseBody : msg.body;
    }

    function emitReply() {

        console.log(`Replying to ${replyTo}`);
        console.log(`Response content type is ${contentType}`);

        const reply = {
            statusCode: 200,
            headers: {
                [HEADER_CONTENT_TYPE]: contentType
            },
            body: responseBody
        };

        if (msg.body.customHeaders) {
            console.log('Applying custom headers: %j', msg.body.customHeaders);
            Object.assign(reply.headers, msg.body.customHeaders);
        }

        debug('Replying with %j', reply);
        self.emit('httpReply', reply);
    }

    function getContentType() {
        const contentType = msg.body.contentType;

        if (contentType) {
            if (/^application|text\//.test(contentType)) {
                return contentType;
            }

            throw new Error(`Content-type ${contentType} is not supported`);
        }

        return DEFAULT_CONTENT_TYPE;
    }

    function emitData() {
        const origMessage = msg.original_message;

        if (origMessage) {
            debug('Emitting original message');
            return self.emit('data', origMessage);
        }

        debug('Original message not found. Emitting data.');
        self.emit('data', msg);
    }

    function onError(e) {
        console.log(e);
        self.emit('error', e);
    }

    function onEnd() {
        console.log(`Finished processing message for replyTo=${replyTo}`);
        self.emit('end');
    }
};
