const { Provider } = require('./Provider');
const { ResponseType } = require('./ResponseType');
const { PackageInfo } = require('../package/PackageInfo');
const { PackageStatus } = require('../package/PackageStatus');
const { codes } = require('./statusCode/uspsStatusCode');

class UspsProvider extends Provider {
    constructor(userId) {
        super();
        this.userId = userId;
    }

    getUrl(trackingNumber) {
        return `http://production.shippingapis.com/ShippingAPI.dll?API=TrackV2&XML=${this.createRequestXml(
            trackingNumber
        )}`;
    }

    getOptions() {
        return {
            method: 'POST'
        };
    }

    getResponseType() {
        return ResponseType.XML;
    }

    parse(response) {
        const error =
            response.TrackResponse && response.TrackResponse.TrackInfo
                ? response.TrackResponse.TrackInfo.Error
                : undefined;
        if (error && error.Number === '-2147219283')
            return new PackageInfo(PackageStatus.LABEL_CREATED);

        if (error || response.Error || !response.TrackResponse.TrackInfo)
            return new PackageInfo();

        const pkg = response.TrackResponse.TrackInfo;

        const lastEvent = [
            pkg.TrackSummary,
            ...([pkg.TrackDetail].flat() ?? [])
        ][0];

        const eventCode = lastEvent.EventCode;
        const expectedDeliveryDate = pkg.ExpectedDeliveryDate;

        const status = codes.get(eventCode) ?? PackageStatus.IN_TRANSIT;
        const label = lastEvent.Event;
        const deliveryTime =
            status === PackageStatus.DELIVERED
                ? new Date(
                      `${lastEvent.EventDate} ${lastEvent.EventTime}`
                  ).getTime()
                : expectedDeliveryDate
                ? new Date(expectedDeliveryDate).getTime() +
                  (12 + 9) * 60 * 60 * 1000 // When no time is provided, set time to 9pm
                : undefined;

        return new PackageInfo(status, label, deliveryTime);
    }

    createRequestXml(trackingNumber) {
        return `<TrackFieldRequest USERID="${this.userId}">
            <Revision>1</Revision>
            <ClientIp>127.0.0.1</ClientIp>
            <SourceId>1</SourceId>
            <TrackID ID="${trackingNumber}"/>
            </TrackFieldRequest>`;
    }
}

module.exports = {
    UspsProvider
};
