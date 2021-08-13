const { Provider } = require('./Provider');
const { ResponseType } = require('./ResponseType');
const { PackageInfo } = require('../package/PackageInfo');
const { codes } = require('./statusCode/fedexStatusCode');

class FedexProvider extends Provider {
    constructor(key, password, accountNumber, meterNumber) {
        super();
        this.key = key;
        this.password = password;
        this.accountNumber = accountNumber;
        this.meterNumber = meterNumber;
    }

    getUrl() {
        return 'https://ws.fedex.com:443/web-services';
    }

    getOptions(trackingNumber) {
        return {
            method: 'POST',
            headers: {
                'Content-Type': 'text/xml'
            },
            body: this.createRequestXml(trackingNumber)
        };
    }

    getResponseType() {
        return ResponseType.SOAP;
    }

    parse(response) {
        if (
            'ERROR' ===
            response.TrackReply.CompletedTrackDetails.TrackDetails.Notification
                .Severity
        )
            return new PackageInfo();

        const lastEvent = [
            response.TrackReply.CompletedTrackDetails.TrackDetails.Events
        ].flat()[0];
        const estimatedDeliveryTimestamp =
            response.TrackReply.CompletedTrackDetails.TrackDetails
                .EstimatedDeliveryTimestamp;

        const status = codes.get(lastEvent.EventType);
        const label = lastEvent.EventDescription;
        const deliveryTime = new Date(
            estimatedDeliveryTimestamp ?? lastEvent.Timestamp
        ).getTime();

        return new PackageInfo(status, label, deliveryTime);
    }

    createRequestXml(trackingNumber) {
        return `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:v9="http://fedex.com/ws/track/v9">
            <soapenv:Body>
            <TrackRequest xmlns="http://fedex.com/ws/track/v9">
            <WebAuthenticationDetail>
            <UserCredential>
            <Key>${this.key}</Key>
            <Password>${this.password}</Password>
            </UserCredential>
            </WebAuthenticationDetail>
            <ClientDetail>
            <AccountNumber>${this.accountNumber}</AccountNumber>
            <MeterNumber>${this.meterNumber}</MeterNumber>
            </ClientDetail>
            <Version>
            <ServiceId>trck</ServiceId>
            <Major>9</Major>
            <Intermediate>1</Intermediate>
            <Minor>0</Minor>
            </Version>
            <SelectionDetails>
            <PackageIdentifier>
            <Type>TRACKING_NUMBER_OR_DOORTAG</Type>
            <Value>${trackingNumber}</Value>
            </PackageIdentifier>
            </SelectionDetails>
            <ProcessingOptions>INCLUDE_DETAILED_SCANS</ProcessingOptions>
            </TrackRequest>
            </soapenv:Body>
            </soapenv:Envelope>`;
    }
}

module.exports = {
    FedexProvider
};