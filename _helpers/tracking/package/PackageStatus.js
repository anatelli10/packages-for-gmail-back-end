const PackageStatus = {
    UNAVAILABLE: 0,
    LABEL_CREATED: 1,
    IN_TRANSIT: 2,
    OUT_FOR_DELIVERY: 3,
    DELIVERY_ATTEMPTED: 4,
    RETURNED_TO_SENDER: 5,
    EXCEPTION: 6,
    DELIVERED: 7
};

module.exports = {
    PackageStatus
};
