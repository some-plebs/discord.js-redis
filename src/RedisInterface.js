const redis = require('redis');
const tsubaki = require('tsubaki');

tsubaki.promisifyAll(redis.RedisClient.prototype);
tsubaki.promisifyAll(redis.Multi.prototype);

module.exports = class RedisInterface {
  constructor(options = {}) {
    this.client = redis.createClient(options);
  }

  init(client) {
    const q = this.client.multi();
    client.users.forEach(u => q.hmset(`user:${u.id}`, u));
    client.guilds.forEach(g => q.hmset(`guild:${g.id}`, g));
    client.emojis.forEach(e => q.hmset(`emoji:${e.id}`, e));
    client.channels.forEach(c => q.hmset(`channel:${c.id}`, c));
    q.hmset('user:me', RedisInterface.clean(client.user));
    return q.execAsync();
  }

  setChannel(channel) {
    return this._setData('channel', channel);
  }

  deleteChannel(channel) {
    return this._deleteData('channel', channel.id);
  }

  setUser(user) {
    if (user.client.user.id === user.id) this.client.hmsetAsync('user:me', RedisInterface.clean(user));
    return this._setData('user', user);
  }

  deleteUser(user) {
    return this._deleteData('user', user.id);
  }

  setGuild(guild) {
    return this._setData('guild', guild);
  }

  deleteGuild(guild) {
    return this._deleteData('guild', guild.id);
  }

  setEmoji(emoji) {
    return this._setData('emoji', emoji);
  }

  deleteEmoji(emoji) {
    return this._deleteData('emoji', emoji.id);
  }

  setMessage(message) {
    return this._setData('message', message).then(() => {
      const cache = message.client.options.messageCacheLifetime;
      if (cache) return this.client.expireAsync(`message:${message.id}`, cache);
      return Promise.resolve(null);
    });
  }

  deleteMessage(message) {
    return this._deleteData('message', message.id);
  }

  _setData(type, data) {
    return this.client.hmsetAsync(`${type}:${data.id}`, RedisInterface.clean(data)).then(
      result => this.client.publish(`${type}Set`, data.id).then(() => result));
  }

  _deleteData(type, id) {
    return this.client.hdelAsync(`${type}:${id}`).then(
      result => this.client.publish(`${type}Delete`, id).then(() => result));
  }

  static clean(obj) {
    const out = {};
    Object.keys(obj).forEach((key) => {
      if (!(obj[key] instanceof Object) && obj[key] !== null && typeof obj[key] !== 'undefined') out[key] = obj[key];
    });
    return out;
  }
};
