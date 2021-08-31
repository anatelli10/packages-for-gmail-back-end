const base64url = require('base64url');
const NodeCache = require('node-cache');
const textVersion = require('textversionjs');
const { findTracking, fedex, ups, usps, s10 } = require('ts-tracking-number');
const { track } = require('ts-shipment-tracking');
const { google } = require('googleapis');
const { getAccessToken } = require('_helpers/googleAuth');
// const {
//   ifElse,
//   pipe,
//   isNil,
//   applySpec,
//   path,
//   cond,
//   pathEq,
//   propEq,
//   always,
//   andThen,
//   unless,
//   prop,
//   __,
//   pipeWith,
//   map,
//   find,
//   when,
//   both,
//   either,
//   complement,
//   replace,
//   propSatisfies,
//   equals
// } = require('ramda');

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

// Temporary helper array to convert new ts-shipment-tracking string statuses back to index numbers
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

const getInfo = (trackingInfo) =>
  trackingInfo
    ? {
        status: statuses[trackingInfo.events[0].status],
        label: trackingInfo.events[0].status,
        deliveryDate:
          trackingInfo.events[0].status === 'DELIVERED'
            ? trackingInfo.events[0].date
            : trackingInfo.estimatedDeliveryDate
      }
    : undefined;

const getTrackingInfo = (trackingNumber) =>
  trackingCache.has(trackingNumber) ? trackingCache.get(trackingNumber) : track(trackingNumber).then(getInfo);

const getTracking = (trackingNumber) =>
  getTrackingInfo(trackingNumber).then((trackingInfo) => {
    trackingCache.set(trackingNumber, trackingInfo);
    return trackingInfo;
  });

const updatePackage = (package) =>
  (Date.now() - package.messageDate) / (24 * 60 * 60) >= AMOUNT_OF_DAYS
    ? Promise.resolve(package)
    : getTracking(package.trackingNumber).then((response) => ({
        ...package,
        ...response
      }));

const updateExistingPackages = (account) => Promise.all(account.packages.map(updatePackage));

const getNestedPart = (parts) => {
  let nested = parts.find((p) => p.parts);
  while (nested) {
    parts = nested.parts;
    nested = parts.find((p) => p.parts);
  }
  return parts.find((p) => p.mimeType === 'text/plain') ?? parts.find((p) => p.mimeType === 'text/html');
};

const getPart = (part) => (part.parts ? getNestedPart(part.parts) : part);

const getPlainBody = (message) => {
  const part = getPart(message.data.payload);
  if (!part || (part.mimeType !== 'text/plain' && part.mimeType !== 'text/html')) return '';
  return textVersion(base64url.decode(part.body.data)).replace(nonCourierLinkPattern, '');
};

const refreshGoogleToken = (account) =>
  getAccessToken(account.googleRefreshToken).then(({ data }) => {
    account.googleAccessToken = data.access_token;
    return account.save();
  });

const getPackages = (account) => (messages) => {
  const uniques = new Set(account.packages.map((p) => p.trackingNumber));
  return Promise.all(
    messages.flatMap((message) =>
      findTracking(getPlainBody(message), [fedex, ups, usps, s10]).map(({ trackingNumber, courier }) => {
        if (uniques.has(trackingNumber)) return;
        uniques.add(trackingNumber);

        const messageData = {
          trackingNumber,
          courierCode: courier.code === 's10' ? 'usps' : courier.code,
          messageId: message.data.id,
          messageDate: parseInt(message.data.internalDate),
          sender: message.data.payload.headers
            .find((header) => header.name === 'From')
            .value.match(/^"?([^"@<]+)"?(?:@|\s<|$)/)[1],
          senderUrl: message.data.payload.headers
            .find((header) => header.name === 'From')
            .value.match(/(?:@|.)([^@.]*\.[a-z]{2,4})(?:>|$)/i)[1],
          updated: Date.now()
        };

        return getTracking(trackingNumber).then((tracking) =>
          tracking
            ? {
                ...tracking,
                ...messageData
              }
            : Date.now() - messageData.messageDate <= 2 * 24 * 60 * 60 * 1000 // no status but less than 2 days old
            ? {
                status: 0,
                ...messageData
              }
            : undefined
        );
      })
    )
  ).then((res) => res.filter(Boolean));
};

const getMessages = (account) => (messageIds) =>
  Promise.all(
    messageIds.map((message) =>
      gmail.users.messages.get(
        { userId: account.email, id: message.id },
        {
          headers: {
            Authorization: 'Bearer ' + account.googleAccessToken,
            Accept: 'application/json'
          }
        }
      )
    )
  ).then((res) => res.sort((a, b) => (a.data.internalDate > b.data.internalDate ? 1 : -1)));

const getMessageIds = async (account) => {
  const messageIds = [];
  let pageToken;
  do {
    const { data } = await gmail.users.messages.list(
      {
        userId: account.email,
        pageToken,
        q:
          account.updated && (Date.now() - account.updated) / (24 * 60 * 60) < 90
            ? '{track tracking} after:' + ((account.updated / 1000) | 0)
            : '{track tracking} newer_than:' + 90 + 'd'
      },
      {
        headers: {
          Authorization: 'Bearer ' + account.googleAccessToken,
          Accept: 'application/json'
        }
      }
    );
    if (data.messages) messageIds.push(...data.messages);
    pageToken = data.nextPageToken;
  } while (pageToken);
  return messageIds;
};

const findNewPackages = (account) =>
  getMessageIds(account)
    .then(getMessages(account))
    .then(getPackages(account))
    .catch((err) => {
      if (err.message === 'Invalid Credentials')
        return refreshGoogleToken(account).then(() => findNewPackages(account));
      console.log(err);
      throw err;
    });

module.exports = { getTracking, updateExistingPackages, findNewPackages };

// const getInfo = applySpec({
//   status: pipe(path(['events', '0', 'status']), prop(__, statuses)),
//   label: path(['events', '0', 'label']),
//   deliveryDate: ifElse(
//     pathEq(['events', '0', 'status'], 'DELIVERED'),
//     path(['events', '0', 'date']),
//     prop('estimatedDeliveryDate')
//   )
// });

// const getTrackingInfo = ifElse(
//   trackingCache.has,
//   trackingCache.get,
//   pipeWith(andThen, [track, unless(isNil, getInfo)])
// );

// const updateExistingPackages = ifElse(
//   isNil,
//   always([]),
//   pipe(map(updatePackage), (prs) => Promise.all(prs))
// );

// const getNestedPart = cond([
//   [find(prop('parts')), pipe(find(prop('parts')), prop('parts'), (a) => getNestedPart(a))],
//   [find(propEq('mimeType', 'text/plain')), find(propEq('mimeType', 'text/plain'))],
//   [find(propEq('mimeType', 'text/html')), find(propEq('mimeType', 'text/html'))]
// ]);

// const getPart = when(prop('parts'), pipe(prop('parts'), getNestedPart));

// const getPlainBody = pipe(
//   path(['data', 'payload']),
//   getPart,
//   ifElse(
//     either(isNil, propSatisfies(both(complement(equals('text/plain')), complement(equals('text/html'))), 'mimeType')),
//     always(''),
//     pipe(path(['body', 'data']), base64url.decode, textVersion, replace(nonCourierLinkPattern, ''))
//   )
// );

// const appendTrackingToOrDelete = (val) => (tracking) =>
//   tracking
//     ? {
//         ...val,
//         ...tracking
//       }
//     : Date.now() - val.messageDate < 2 * 24 * 60 * 60 * 1000
//     ? {
//         ...val,
//         status: 0
//       }
//     : undefined;

// const appendTrackingOrDelete = (val) => getTracking(val.trackingNumber).then(appendTrackingToOrDelete(val));

// const getPackageFromMessage = (message) =>
//   findTracking(getPlainBody(message), [fedex, ups, usps, s10]).map(({ trackingNumber, courier }) => ({
//     trackingNumber,
//     courierCode: courier.code === 's10' ? 'usps' : courier.code,
//     messageId: message.data.id,
//     messageDate: parseInt(message.data.internalDate),
//     sender: message.data.payload.headers
//       .find((header) => header.name === 'From')
//       .value.match(/^"?([^"@<]+)"?(?:@|\s<|$)/)[1],
//     senderUrl: message.data.payload.headers
//       .find((header) => header.name === 'From')
//       .value.match(/(?:@|.)([^@.]*\.[a-z]{2,4})(?:>|$)/i)[1],
//     updated: Date.now()
//   }));

// const withoutDuplicateProp = (prop, arr, account) =>
//   Array.from(arr.reduce((map, val) => (map.has(val[prop]) ? map : map.set(val[prop], val)), new Map()).values());

// const getPackages = (account) => (messages) =>
//   Promise.all(
//     withoutDuplicateProp('trackingNumber', messages.flatMap(getPackageFromMessage), account).map(appendTrackingOrDelete)
//   ).then((res) => res.filter(Boolean));

// const getMessageIds = (account, pageToken, messages = []) =>
//   gmail.users.messages
//     .list(
//       {
//         userId: account.email,
//         pageToken,
//         q:
//           account.updated && (Date.now() - account.updated) / (24 * 60 * 60) < 90
//             ? '{track tracking} after:' + ((account.updated / 1000) | 0)
//             : '{track tracking} newer_than:' + 90 + 'd'
//       },
//       {
//         headers: {
//           Authorization: 'Bearer ' + account.googleAccessToken,
//           Accept: 'application/json'
//         }
//       }
//     )
//     .then(({ data }) =>
//       data.nextPageToken
//         ? getMessageIds(account, data.nextPageToken, messages.concat(data.messages))
//         : messages.concat(data.messages)
//     );
