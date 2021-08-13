const config = require('config.json');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('_helpers/db');
const Role = require('_helpers/role');
const { google } = require('googleapis');
const { findTracking, fedex, ups, usps } = require('ts-tracking-number');
const base64url = require('base64url');
const textVersion = require('textversionjs');
const { getAccessToken } = require('_helpers/googleAuth');
const { track } = require('_helpers/tracking');
const { getToken } = require('_helpers/googleAuth');

module.exports = {
    refreshToken,
    revokeToken,
    authCallback,
    signIn,
    delete: _delete,
    getPackages,
    restorePackages,
    resetPackages,
    deletePackages,
    addPackage
};

// Find tracking numbers from messages this many days old or newer
const AMOUNT_OF_DAYS = 90;

const gmail = google.gmail('v1');

// Matches any links not from a courier website (i.e. skips https://usps.com/foobar but matches https://google.com/foobar )
const nonCourierLinkPattern = new RegExp(
    `https?:\\/\\/(?:www\\.)?((?!.*${[fedex, ups, usps]
        .map(courier => courier.courier_code)
        .join(
            '|.*'
        )}).*)\\.[a-zA-Z0-9()]{1,6}\\b(?:[-a-zA-Z0-9()@:%_\\+.~#?&//=]*)`,
    'gi'
);

async function authCallback(code, emailAddress, ipAddress, origin) {
    const { access_token, refresh_token, id_token, expiry_date } = (
        await getToken(code)
    ).tokens;

    const { email, given_name, family_name } = jwt.decode(id_token);

    if (email !== emailAddress) {
        return res.status(400)
            .send(`Error: Authenticated with the wrong account.
      Authenticated with "${email}" instead of "${
            emailAddress ?? 'unknown'
        }".`);
    }

    return signIn(
        {
            email,
            firstName: given_name,
            lastName: family_name,
            googleAccessToken: access_token,
            googleRefreshToken: refresh_token,
            googleTokenExpiry: expiry_date
        },
        ipAddress,
        origin
    );
}

async function getPackages(email) {
    const account = await getAccountByEmail(email);

    // Only update up to once per hour
    if (Date.now() - account.updated < 60 * 60 * 1000) return account.packages;

    await updateExistingPackages(account.packages);
    await findNewPackages(account);

    account.updated = Date.now();
    await account.save();

    return account.packages;
}

async function updateExistingPackages(packages) {
    const now = Date.now();
    for (const package of packages) {
        // Skip packages who are 90 days or older
        if (
            (Date.now() - package.messageDate) / (24 * 60 * 60) >=
            AMOUNT_OF_DAYS
        )
            continue;

        const info = await track(package.courierCode, package.trackingNumber);
        package.updated = now;

        if (package.status != info.status) package.status = info.status;

        if (package.label != info.label) package.label = info.label;

        if (package.deliveryTime != info.deliveryTime)
            package.deliveryTime = info.deliveryTime;
    }
}

async function findNewPackages(account) {
    const userId = account.email;
    const q =
        account.updated &&
        (Date.now() - account.updated) / (24 * 60 * 60) < AMOUNT_OF_DAYS
            ? '{track tracking} after:' + ((account.updated / 1000) | 0)
            : '{track tracking} newer_than:' + AMOUNT_OF_DAYS + 'd';
    const options = {
        headers: {
            Authorization: 'Bearer ' + account.googleAccessToken,
            Accept: 'application/json'
        }
    };
    const existingNumbers = new Set(
        account.packages.map(package => package.trackingNumber)
    );

    try {
        var messages = [];
        let pageToken;

        // Get all messages as objects containing id and threadid
        do {
            const { data } = await gmail.users.messages.list(
                { userId, pageToken, q },
                options
            );
            if (!data.messages) return;
            messages.push(...data.messages);
            pageToken = data.nextPageToken;
        } while (pageToken);

        // Transform from objects containing id and threadid to objects containing message data
        messages = await Promise.all(
            messages.map(message =>
                gmail.users.messages.get({ userId, id: message.id }, options)
            )
        );

        // Sort by ascending date
        messages = messages.sort((a, b) =>
            a.data.internalDate > b.data.internalDate ? 1 : -1
        );
    } catch (err) {
        if (err.message !== 'Invalid Credentials') throw err;

        // Refresh google token
        const { access_token } = await getAccessToken(
            account.googleRefreshToken
        )
            .then(res => res.data)
            .catch(err => {
                console.log(err);
                throw err;
            });
        account.googleAccessToken = access_token;
        await account.save();

        // Retry
        return findNewPackages(account);
    }

    for (const message of messages) {
        const from = message.data.payload.headers.find(
            header => header.name === 'From'
        ).value;
        let senderUrl = from.match(/(?:@|.)([^@.]*\.[a-z]{2,4})(?:>|$)/i);
        senderUrl = senderUrl
            ? senderUrl[1] === 'gmail.com'
                ? 'mail.google.com'
                : senderUrl[1]
            : undefined;
        let sender = from.match(/^"?([^"@<]+)"?(?:@|\s<|$)/);
        sender = sender
            ? sender[1].trim().replace(/_/g, ' ')
            : senderUrl ?? 'Unknown';

        const messageId = message.data.id;
        const messageDate = parseInt(message.data.internalDate);
        const messageBody = getPlainBody(message);

        // Find tracking numbers in message bodies
        for (const tracking of findTracking(messageBody, [fedex, ups, usps])) {
            const trackingNumber = tracking.trackingNumber;
            const courierCode = tracking.courier.code;

            // Skip duplicates
            if (existingNumbers.has(trackingNumber)) continue;

            const info = await track(courierCode, trackingNumber);

            if (!info) continue;

            existingNumbers.add(trackingNumber);
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
            const nested = parts.find(part => part.parts);
            if (!nested) break;
            parts = nested.parts;
        }
        part = parts.find(part => part.mimeType === 'text/plain');
        if (!part) part = parts.find(part => part.mimeType === 'text/html');
        if (!part) return '';
    }

    const isHtml = part.mimeType === 'text/html';
    if (!isHtml && part.mimeType !== 'text/plain') return '';

    body = base64url.decode(part.body.data);
    if (isHtml) body = textVersion(body);
    body = body.replace(nonCourierLinkPattern, '');

    return body;
}

async function restorePackages(email) {
    const account = await getAccountByEmail(email);

    account.updated = undefined;
    await account.save();

    return getPackages(email);
}

async function resetPackages(email) {
    const account = await getAccountByEmail(email);

    account.packages = undefined;
    account.updated = undefined;
    await account.save();

    return getPackages(email);
}

async function addPackage(email, body) {
    const account = await getAccountByEmail(email);
    const { courierCode, trackingNumber, sender, senderUrl } = body;

    if (
        account.packages.find(
            package => trackingNumber === package.trackingNumber
        )
    )
        throw 'Tracking number already exists';

    const info = await track(courierCode, trackingNumber);
    if (!info) throw 'Invalid tracking number';
    const package = {
        ...info,
        trackingNumber,
        courierCode,
        messageDate: Date.now(),
        sender,
        senderUrl,
        updated: Date.now()
    };
    account.packages.push(package);
    account.updated = Date.now();
    await account.save();

    return package;
}

async function deletePackages(email, body) {
    const account = await getAccountByEmail(email);
    const selected = new Set(body);
    account.packages = account.packages.filter(
        package => !selected.has(package.trackingNumber)
    );
    account.updated = Date.now();
    await account.save();
}

async function refreshToken({ token, ipAddress }) {
    const refreshToken = await getRefreshToken(token);
    const { account } = refreshToken;

    // replace old refresh token with a new one and save
    const newRefreshToken = generateRefreshToken(account, ipAddress);
    refreshToken.revoked = Date.now();
    refreshToken.revokedByIp = ipAddress;
    refreshToken.replacedByToken = newRefreshToken.token;
    await refreshToken.save();
    await newRefreshToken.save();

    // generate new jwt
    const jwtToken = generateJwtToken(account);

    // return basic details and tokens
    return {
        ...basicDetails(account),
        jwtToken,
        refreshToken: newRefreshToken.token
    };
}

async function revokeToken({ token, ipAddress }) {
    const refreshToken = await getRefreshToken(token);

    // revoke token and save
    refreshToken.revoked = Date.now();
    refreshToken.revokedByIp = ipAddress;
    await refreshToken.save();
}

async function signIn(params, ipAddress, origin) {
    let account = await db.Account.findOne({ email: params.email });
    if (!account) {
        account = new db.Account(params);
        const isFirstAccount = (await db.Account.countDocuments({})) === 0;
        account.role = isFirstAccount ? Role.Admin : Role.User;
        await account.save();
    }

    const jwtToken = generateJwtToken(account);
    const refreshToken = generateRefreshToken(account, ipAddress);

    // save refresh token
    await refreshToken.save();

    // return basic details and tokens
    return {
        ...basicDetails(account),
        jwtToken,
        refreshToken: refreshToken.token
    };
}

async function _delete(id) {
    const account = await getAccount(id);
    await account.remove();
}

// helper functions

async function getAccountByEmail(email) {
    const account = await db.Account.findOne({ email });
    if (!account) throw 'Account not found';
    return account;
}

async function getAccount(id) {
    if (!db.isValidId(id)) throw 'Account not found';
    const account = await db.Account.findById(id);
    if (!account) throw 'Account not found';
    return account;
}

async function getRefreshToken(token) {
    const refreshToken = await db.RefreshToken.findOne({ token }).populate(
        'account'
    );
    if (!refreshToken || !refreshToken.isActive) throw 'Invalid token';
    return refreshToken;
}

function generateJwtToken(account) {
    // create a jwt token containing the account id that expires in 1 hour
    return jwt.sign({ sub: account.id, id: account.id }, config.secret, {
        expiresIn: '1h'
    });
}

function generateRefreshToken(account, ipAddress) {
    // create a refresh token that expires in 6 months
    return new db.RefreshToken({
        account: account.id,
        token: randomTokenString(),
        expires: new Date(Date.now() + 6 * 30 * 7 * 24 * 60 * 60 * 1000),
        createdByIp: ipAddress
    });
}

function randomTokenString() {
    return crypto.randomBytes(40).toString('hex');
}

function basicDetails(account) {
    const { id, email, firstName, lastName, role, created, updated } = account;
    return { id, email, firstName, lastName, role, created, updated };
}
