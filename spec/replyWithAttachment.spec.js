const sinon = require('sinon');
const nock = require('nock');
const { expect } = require('chai');
const { messages } = require('elasticio-node');
const logger = require('@elastic.io/component-logger')();
const { Readable } = require('stream');
const replyWithAttachment = require('../replyWithAttachment');

describe('Reply with attachment', () => {
  const msg = messages.newMessageWithBody({
    contentType: 'image/png',
    responseUrl: 'http://fake_api',
    customHeaders: {
      'X-Test-Header1': 'test1',
      'X-Test-Header2': 'test2',
    },
  });

  msg.headers = {
    reply_to: 'my_routing_key_123',
  };

  const storageResponse = {
    objectId: 'fake_id',
  };
  const getFakeStream = () => {
    const stream = new Readable();
    stream.push('fake_data');
    stream.push(null);
    return stream;
  };

  describe('replyWithAttachment', () => {
    describe('emit reply', () => {
      it(`should emit reply with attachment(${msg.body.contentType})`, async () => {
        const self = {
          emit: sinon.spy(),
          logger,
        };

        const getAttachment = nock(msg.body.responseUrl)
          .get('/')
          .reply(200, getFakeStream());
        const saveAttachmentToStore = nock(
          process.env.ELASTICIO_OBJECT_STORAGE_URI
        )
          .post('/objects')
          .reply(200, storageResponse);

        await replyWithAttachment.process.bind(self)(msg);
        expect(getAttachment.isDone()).to.be.equal(true);
        expect(saveAttachmentToStore.isDone()).to.be.equal(true);

        const spy = self.emit;
        expect(spy.callCount).to.be.equal(2);

        expect(spy.getCall(0).args[0]).to.be.equal('data');
        expect(spy.getCall(0).args[1].headers).to.be.deep.equal({
          'Content-Type': msg.body.contentType,
          'X-EIO-Routing-Key': msg.headers.reply_to,
          'x-ipaas-object-storage-id': storageResponse.objectId,
          ...msg.body.customHeaders,
        });
        expect(spy.getCall(0).args[1].body).to.be.deep.equal({});

        expect(spy.getCall(1).args[0]).to.be.equal('data');
        expect(spy.getCall(1).args[1].headers).to.be.deep.equal({});
        expect(spy.getCall(1).args[1].body).to.be.deep.equal(msg.body);
      });

      it('should emit reply with attachment(use default contentType)', async () => {
        const msgNoContentType = JSON.parse(JSON.stringify(msg));
        delete msgNoContentType.body.contentType;

        const self = {
          emit: sinon.spy(),
          logger,
        };

        const getAttachment = nock(msgNoContentType.body.responseUrl)
          .get('/')
          .reply(200, getFakeStream());
        const saveAttachmentToStore = nock(
          process.env.ELASTICIO_OBJECT_STORAGE_URI
        )
          .post('/objects')
          .reply(200, storageResponse);

        await replyWithAttachment.process.bind(self)(msgNoContentType);
        expect(getAttachment.isDone()).to.be.equal(true);
        expect(saveAttachmentToStore.isDone()).to.be.equal(true);

        const spy = self.emit;
        expect(spy.callCount).to.be.equal(2);

        expect(spy.getCall(0).args[0]).to.be.equal('data');
        expect(spy.getCall(0).args[1].headers).to.be.deep.equal({
          'Content-Type': 'application/json',
          'X-EIO-Routing-Key': msg.headers.reply_to,
          'x-ipaas-object-storage-id': storageResponse.objectId,
          ...msg.body.customHeaders,
        });
        expect(spy.getCall(0).args[1].body).to.be.deep.equal({});

        expect(spy.getCall(1).args[0]).to.be.equal('data');
        expect(spy.getCall(1).args[1].headers).to.be.deep.equal({});
        expect(spy.getCall(1).args[1].body).to.be.deep.equal(
          msgNoContentType.body
        );
      });
    });

    describe('emit error', () => {
      it('should emit error (no message)', async () => {
        const self = {
          emit: sinon.spy(),
          logger,
        };

        await replyWithAttachment.process.bind(self)();

        const spy = self.emit;
        const call = spy.getCall(0);

        expect(call.args[0]).to.be.equal('error');

        const error = call.args[1];

        expect(error.message).to.be.equal(
          "Cannot read property 'headers' of undefined"
        );
      });

      it('should emit error (empty body)', async () => {
        const self = {
          emit: sinon.spy(),
          logger,
        };

        await replyWithAttachment.process.bind(self)({
          ...msg,
          body: {},
        });

        const spy = self.emit;
        const call = spy.getCall(0);

        expect(call.args[0]).to.be.equal('error');

        const error = call.args[1];

        expect(error.message).to.be.equal(
          '"responseUrl" field can not be empty!'
        );
      });

      it('should emit error (empty headers)', async () => {
        const self = {
          emit: sinon.spy(),
          logger,
        };

        await replyWithAttachment.process.bind(self)({
          ...msg,
          headers: {},
        });

        const spy = self.emit;
        const call = spy.getCall(0);

        // only return, no reply_to
        expect(call).to.be.equal(null);
      });
    });
  });
});
