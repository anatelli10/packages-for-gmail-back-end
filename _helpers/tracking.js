const base64url = require('base64url');
const textVersion = require('textversionjs');
const { findTracking, fedex, ups, usps, s10 } = require('ts-tracking-number');
const { track } = require('ts-shipment-tracking');
const { google } = require('googleapis');
const { getAccessToken } = require('_helpers/googleAuth');
const NodeCache = require('node-cache');

module.exports = { getTracking, updateExistingPackages, findNewPackages };

const gmail = google.gmail('v1');

// Caches tracking number info for 1 hour to comply with courier API guidelines
const trackingCache = new NodeCache({ stdTTL: 60 * 60 });

// Find tracking numbers from messages this many days old or newer
const AMOUNT_OF_DAYS = 90;

// Matches any links not from a courier website (i.e. skips https://usps.com/foobar but matches https://google.com/foobar)
const nonCourierLinkPattern = new RegExp(
  `https?:\\/\\/(?:www\\.)?((?!.*${[fedex, ups, usps]
    .map((courier) => courier.courier_code)
    .join('|.*')}).*)\\.[a-zA-Z0-9()]{1,6}\\b(?:[-a-zA-Z0-9()@:%_\\+.~#?&//=]*)`,
  'gi'
);

// Temporary helper function to convert new ts-shipment-tracking string statuses back to index numbers
const statuses = {
  UNAVAILABLE: 0,
  LABEL_CREATED: 1,
  IN_TRANSIT: 2,
  OUT_FOR_DELIVERY: 3,
  DELIVERY_ATTEMPTED: 4,
  RETURNED_TO_SENDER: 5,
  EXCEPTION: 6,
  DELIVERED: 7
};

async function getTracking(trackingNumber) {
  const cached = trackingCache.get(trackingNumber);
  if (cached) return cached;

  const info = await track(trackingNumber);

  if (!info) return;

  const delivered = info.events[0].status === 'DELIVERED';
  info.events[0].status = statuses[info.events[0].status];

  const tracking = {
    ...info.events[0],
    deliveryDate: info.estimatedDeliveryDate ?? delivered ? info.events[0].date : undefined
  };

  trackingCache.set(trackingNumber, tracking);

  return tracking;
}

async function updateExistingPackages(packages) {
  const now = Date.now();
  if (!packages) return;
  for (const package of packages) {
    // Skip packages who are 90 days or older
    if ((Date.now() - package.messageDate) / (24 * 60 * 60) >= AMOUNT_OF_DAYS) continue;

    const info = await getTracking(package.trackingNumber);
    package.updated = now;

    if (package.status != info.status) package.status = info.status;

    if (package.label != info.label) package.label = info.label;

    if (package.deliveryDate != info.deliveryDate) package.deliveryDate = info.deliveryDate;
  }
}

async function findNewPackages(account) {
  const userId = account.email;
  const q =
    account.updated && (Date.now() - account.updated) / (24 * 60 * 60) < AMOUNT_OF_DAYS
      ? '{track tracking} after:' + ((account.updated / 1000) | 0)
      : '{track tracking} newer_than:' + AMOUNT_OF_DAYS + 'd';
  const options = {
    headers: {
      Authorization: 'Bearer ' + account.googleAccessToken,
      Accept: 'application/json'
    }
  };
  const existingNumbers = new Set(account.packages.map((package) => package.trackingNumber));

  try {
    var messages = [];
    let pageToken;

    // Get all messages as objects containing id and threadid
    do {
      const { data } = await gmail.users.messages.list({ userId, pageToken, q }, options);
      if (!data.messages) return;
      messages.push(...data.messages);
      pageToken = data.nextPageToken;
    } while (pageToken);

    // Transform from objects containing id and threadid to objects containing message data
    messages = await Promise.all(
      messages.map((message) => gmail.users.messages.get({ userId, id: message.id }, options))
    );

    // Sort by ascending date
    messages = messages.sort((a, b) => (a.data.internalDate > b.data.internalDate ? 1 : -1));
  } catch (err) {
    if (err.message !== 'Invalid Credentials') throw err;

    // Refresh google token
    const { access_token } = await getAccessToken(account.googleRefreshToken)
      .then((res) => res.data)
      .catch((err) => {
        console.log(err);
        throw err;
      });
    account.googleAccessToken = access_token;
    await account.save();

    // Retry
    return findNewPackages(account);
  }

  for (const message of messages) {
    const from = message.data.payload.headers.find((header) => header.name === 'From').value;
    let senderUrl = from.match(/(?:@|.)([^@.]*\.[a-z]{2,4})(?:>|$)/i);
    senderUrl = senderUrl ? (senderUrl[1] === 'gmail.com' ? 'mail.google.com' : senderUrl[1]) : undefined;
    let sender = from.match(/^"?([^"@<]+)"?(?:@|\s<|$)/);
    sender = sender ? sender[1].trim().replace(/_/g, ' ') : senderUrl ?? 'Unknown';

    const messageId = message.data.id;
    const messageDate = parseInt(message.data.internalDate);
    const messageBody = getPlainBody(message);

    // Find tracking numbers in message bodies
    for (const tracking of findTracking(messageBody, [fedex, ups, usps, s10])) {
      const trackingNumber = tracking.trackingNumber;
      const courierCode = tracking.courier.code === 's10' ? 'usps' : tracking.courier.code;

      // Skip duplicates
      if (existingNumbers.has(trackingNumber)) continue;
      existingNumbers.add(trackingNumber);

      const info = await getTracking(trackingNumber);

      if (!info) continue;

      account.packages.push({
        ...info,
        trackingNumber,
        courierCode,
        messageId,
        messageDate,
        sender,
        senderUrl,
        updated: Date.now()
      });
    }
  }
}

function getPlainBody(message) {
  let body;
  let part = message.data.payload;
  let parts = part.parts;
  if (parts) {
    while (true) {
      const nested = parts.find((part) => part.parts);
      if (!nested) break;
      parts = nested.parts;
    }
    part = parts.find((part) => part.mimeType === 'text/plain');
    if (!part) part = parts.find((part) => part.mimeType === 'text/html');
    if (!part) return '';
  }

  const isHtml = part.mimeType === 'text/html';
  if (!isHtml && part.mimeType !== 'text/plain') return '';

  body = base64url.decode(part.body.data);
  if (isHtml) body = textVersion(body);
  body = body.replace(nonCourierLinkPattern, '');

  return body;
}
