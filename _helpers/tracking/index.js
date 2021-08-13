const creds = require('./credentials.json');
const { fedex, ups, usps, s10, getTracking } = require('ts-tracking-number');
const { FedexProvider, UpsProvider, UspsProvider } = require('./provider');
const { PackageInfo } = require('./package/PackageInfo');

module.exports = {
    isCourierValid,
    isNumberValid,
    track
};

/**
 * Key value pairs of courier codes (e.g. 'usps') and their ts-tracking-number data
 */
const couriers = new Map([
    [fedex.courier_code, [fedex]],
    [ups.courier_code, [ups]],
    [usps.courier_code, [usps, s10]]
]);

/**
 * Key value pairs of courier codes and their tracking providers
 */
const providers = new Map([
    [
        fedex.courier_code,
        new FedexProvider(
            creds.fedex.key,
            creds.fedex.password,
            creds.fedex.accountNumber,
            creds.fedex.meterNumber
        )
    ],
    [ups.courier_code, new UpsProvider(creds.ups.accessLicenseNumber)],
    [usps.courier_code, new UspsProvider(creds.usps.userId)]
]);

/**
 * Checks if a courier is supported
 * @param {string} courierCode The courier's short code
 * @returns {boolean} Whether the courier is supported or not
 */
function isCourierValid(courierCode) {
    return providers.has(courierCode);
}

/**
 * Checks if a tracking number is valid
 * @param {string} courierCode The courier's short code
 * @param {string} trackingNumber The package tracking number
 * @returns {boolean} Whether the tracking number is valid or not
 */
function isNumberValid(courierCode, trackingNumber) {
    return !!getTracking(trackingNumber, couriers.get(courierCode) ?? []);
}

/**
 * Queries the specified courier's API for tracking information
 * @param {string} courierCode The courier's short code
 * @param {string} trackingNumber The package tracking number
 * @returns {Promise<PackageInfo>} An object containing the status and estimated delivery date of the package (if it has either)
 */
async function track(courierCode, trackingNumber) {
    const provider = providers.get(courierCode);
    if (!provider)
        throw new Error(
            'Courier with courier code ' + courierCode + ' does not exist.'
        );
    return provider.track(trackingNumber);
}
