const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const schema = new Schema({
  email: { type: String, unique: true, required: true },
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  googleAccessToken: { type: String, required: true },
  googleRefreshToken: { type: String, required: true },
  googleTokenExpiry: Number,
  packages: [
    {
      _id: false,
      trackingNumber: { type: String, required: true },
      courierCode: { type: String, required: true },
      status: { type: String, required: true },
      label: { type: String, required: false },
      deliveryDate: { type: Number, required: false },
      messageId: { type: String, required: false },
      messageDate: { type: Number, required: false },
      sender: { type: String, required: true },
      senderUrl: { type: String, required: false },
      created: { type: Number, default: Date.now },
      updated: Number
    }
  ],
  created: { type: Number, default: Date.now },
  updated: Number
});

schema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: function (doc, ret) {
    // remove this prop when object is serialized
    delete ret._id;
  }
});

module.exports = mongoose.model('Account', schema);
