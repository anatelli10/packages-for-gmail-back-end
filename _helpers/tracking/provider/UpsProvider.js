const dateFns = require('date-fns');
const { Provider } = require('./Provider');
const { ResponseType } = require('./ResponseType');
const { PackageInfo } = require('../package/PackageInfo');
const { PackageStatus } = require('../package/PackageStatus');
const { codes } = require('./statusCode/upsStatusCode');

class UpsProvider extends Provider {
    constructor(accessLicenseNumber) {
        super();
        this.accessLicenseNumber = accessLicenseNumber;
    }

    getUrl(trackingNumber) {
        return `https://onlinetools.ups.com/track/v1/details/${trackingNumber}`;
    }

    getOptions() {
        return {
            headers: {
                AccessLicenseNumber: this.accessLicenseNumber,
                Accept: 'application/json'
            }
        };
    }

    getResponseType() {
        return ResponseType.JSON;
    }

    parse(response) {
        if (
            response.errors ||
            response.trackResponse.shipment[0].warnings ||
            !response.trackResponse.shipment[0].package
        )
            return new PackageInfo();

        const pkg = response.trackResponse.shipment[0].package[0];
        const lastEvent = pkg.activity[0];
        const date = pkg.deliveryDate && pkg.deliveryDate[0].date;
        const time = pkg.deliveryTime ? pkg.deliveryTime.endTime : undefined;

        const label = lastEvent.status.description;

        const statusCode = lastEvent.status.type;
        let status = codes.get(statusCode);
        if (
            status === PackageStatus.EXCEPTION &&
            label.includes('DELIVERY ATTEMPT')
        )
            status = PackageStatus.DELIVERY_ATTEMPTED;

        const deliveryTime =
            date || time
                ? dateFns
                      .parse(
                          `${date ?? ``}${time ?? ``}`,
                          `${date ? `yyyyMMdd` : ``}${time ? `Hmmss` : ``}`,
                          new Date()
                      )
                      .getTime()
                : undefined;

        return new PackageInfo(status, label, deliveryTime);
    }
}

module.exports = {
    UpsProvider
};
