const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('_helpers/db');
const { getTracking, findNewPackages, updateExistingPackages } = require('_helpers/tracking');
const { getToken } = require('_helpers/googleAuth');

module.exports = {
  refreshToken,
  revokeToken,
  authCallback,
  delete: _delete,
  getPackages,
  restorePackages,
  resetPackages,
  deletePackages,
  addPackage
};

async function authCallback(code, emailAddress, ipAddress, origin) {
  const { access_token, refresh_token, id_token, expiry_date } = (await getToken(code)).tokens;

  const { email, given_name, family_name } = jwt.decode(id_token);

  if (email !== emailAddress) {
    return res.status(400).send(`Error: Authenticated with the wrong account.
      Authenticated with "${email}" instead of "${emailAddress ?? 'unknown'}".`);
  }

  let account = await db.Account.findOne({ email });

  if (!account) {
    account = new db.Account({
      email,
      firstName: given_name,
      lastName: family_name,
      googleAccessToken: access_token,
      googleRefreshToken: refresh_token,
      googleTokenExpiry: expiry_date
    });
    const isFirstAccount = (await db.Account.countDocuments({})) === 0;
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

async function getPackages(email) {
  const account = await getAccountByEmail(email);

  // Only update up to once per hour
  // if (Date.now() - account.updated < 60 * 60 * 1000) return account.packages;

  await updateExistingPackages(account.packages);
  await findNewPackages(account);

  account.updated = Date.now();

  await account.save();

  return account.packages;
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

  if (account.packages.find((package) => trackingNumber === package.trackingNumber))
    throw 'Tracking number already exists';

  const info = await getTracking(trackingNumber);
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
  console.log('add:', package);
  account.packages.push(package);
  account.updated = Date.now();
  await account.save();

  return package;
}

async function deletePackages(email, body) {
  const account = await getAccountByEmail(email);
  const selected = new Set(body);
  account.packages = account.packages.filter((package) => !selected.has(package.trackingNumber));
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
  const refreshToken = await db.RefreshToken.findOne({ token }).populate('account');
  if (!refreshToken || !refreshToken.isActive) throw 'Invalid token';
  return refreshToken;
}

function generateJwtToken(account) {
  // create a jwt token containing the account id that expires in 1 hour
  return jwt.sign({ sub: account.id, id: account.id }, process.env.SECRET, {
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
  const { id, email, firstName, lastName, created, updated } = account;
  return { id, email, firstName, lastName, created, updated };
}
