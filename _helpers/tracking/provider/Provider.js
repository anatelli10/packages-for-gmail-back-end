const got = require('got');
const xml = require('fast-xml-parser');
const { PackageInfo } = require('../package/PackageInfo');
const { ResponseType } = require('./ResponseType');

class Provider {
    async track(trackingNumber) {
        try {
            var response = await got(
                this.getUrl(trackingNumber),
                this.getOptions(trackingNumber)
            );
        } catch {
            return new PackageInfo();
        }

        switch (this.getResponseType()) {
            case ResponseType.XML:
                response = xml.parse(response.body, { parseNodeValue: false });
                break;
            case ResponseType.SOAP:
                response = xml.parse(response.body, { parseNodeValue: false })[
                    'SOAP-ENV:Envelope'
                ]['SOAP-ENV:Body'];
                break;
            case ResponseType.JSON:
                response = JSON.parse(response.body);
                break;
        }

        return this.parse(response);
    }
}

module.exports = {
    Provider
};
