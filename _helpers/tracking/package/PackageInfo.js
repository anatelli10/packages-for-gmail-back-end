const { PackageStatus } = require('./PackageStatus');

class PackageInfo {
    constructor(status = PackageStatus.UNAVAILABLE, label, deliveryTime) {
        this.status = status;
        this.label = label;
        this.deliveryTime = deliveryTime;
    }
}

module.exports = {
    PackageInfo
};
