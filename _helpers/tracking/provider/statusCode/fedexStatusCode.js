// codes from https://www.fedex.com/us/developer/webhelp/ws/2020/Docs/FedEx_WebServices_TrackService_WSDLGuide_v2020.pdf

const { PackageStatus } = require('../../package/PackageStatus');

const AT_AIRPORT = 'AA';
const AT_CANADA_POST_FACILITY = 'AC';
const AT_DELIVERY = 'AD';
const AT_FEDEX_FACILITY = 'AF';
const AT_PICKUP = 'AP';
const ARRIVED_AT = 'AR';
const AT_USPS_FACILITY = 'AX';
const BROKER = 'BR';
const SHIPMENT_CANCELLED = 'CA';
const CLEARED_CUSTOMS = 'CC';
const CLEARANCE_DELAY = 'CD';
const LOCATION_CHANGED = 'CH';
const CLEARANCE_IN_PROGRESS = 'CP';
const CUSTOMS = 'CU';
const DELIVERY_DELAY = 'DD';
const DELIVERY_EXCEPTION = 'DE';
const DELIVERED = 'DL';
const DEPARTED = 'DP';
const VEHICLE_FURNISHED_BUT_NOT_USED = 'DR';
const VEHICLE_DISPATCHED = 'DS';
const DELAY = 'DY';
const ENROUTE_TO_AIRPORT = 'EA';
const EXPORT_APPROVED = 'EA';
const ENROUTE_TO_DELIVERY = 'ED';
const ENROUTE_TO_ORIGIN_AIRPORT = 'EO';
const ENROUTE_TO_PICKUP = 'EP';
const AT_FEDEX_DESTINATION = 'FD';
const HOLD_AT_LOCATION = 'HL';
const IN_TRANSIT = 'IT';
const IN_TRANSIT_SEE_DETAILS = 'IX';
const LEFT_ORIGIN = 'LO';
const RETURN_LABEL_LINK_CANCELLED_BY_SHIPMENT_ORIGINATOR = 'LP';
const ORDER_CREATED = 'OC';
const OUT_FOR_DELIVERY = 'OD';
const AT_FEDEX_ORIGIN_FACILITY = 'OF';
const SHIPMENT_INFORMATION_SENT_TO_USPS = 'OX';
const PICKUP_DELAY = 'PD';
const PLANE_IN_FLIGHT = 'PF';
const PLANE_LANDED = 'PL';
const IN_PROGRESS = 'PM';
const PICKED_UP = 'PU';
const PICKED_UP_SEE_DETAILS = 'PX';
const CDO_CANCELLED = 'RC';
const RECIPIENT = 'RC';
const RETURN_LABEL_LINK_EXPIRED = 'RD';
const RETURN_LABEL_LINK_EXPIRING_SOON = 'RG';
const CDO_MODIFIED = 'RM';
const RETURN_LABEL_LINK_EMAILED_TO_RETURN_SENDER = 'RP';
const CDO_REQUESTED = 'RR';
const RETURN_TO_SHIPPER = 'RS';
const SHIPMENT_EXCEPTION = 'SE';
const AT_SORT_FACILITY = 'SF';
const SHIPPER = 'SH';
const SPLIT_STATUS = 'SP';
const TRANSFER_PARTNER = 'TP';
const TRANSFER = 'TR';

const codes = new Map([
    [DELIVERED, PackageStatus.DELIVERED],

    [RETURN_TO_SHIPPER, PackageStatus.RETURNED_TO_SENDER],
    [
        RETURN_LABEL_LINK_EMAILED_TO_RETURN_SENDER,
        PackageStatus.RETURNED_TO_SENDER
    ],
    [
        RETURN_LABEL_LINK_CANCELLED_BY_SHIPMENT_ORIGINATOR,
        PackageStatus.RETURNED_TO_SENDER
    ],
    [RETURN_LABEL_LINK_EXPIRING_SOON, PackageStatus.RETURNED_TO_SENDER],
    [RETURN_LABEL_LINK_EXPIRED, PackageStatus.RETURNED_TO_SENDER],

    [SHIPMENT_CANCELLED, PackageStatus.EXCEPTION],
    [DELIVERY_EXCEPTION, PackageStatus.EXCEPTION],
    [SHIPMENT_EXCEPTION, PackageStatus.EXCEPTION],

    [OUT_FOR_DELIVERY, PackageStatus.OUT_FOR_DELIVERY],

    [PICKED_UP, PackageStatus.LABEL_CREATED],
    [PICKED_UP_SEE_DETAILS, PackageStatus.LABEL_CREATED],
    [ORDER_CREATED, PackageStatus.LABEL_CREATED],

    [AT_AIRPORT, PackageStatus.IN_TRANSIT],
    [AT_CANADA_POST_FACILITY, PackageStatus.IN_TRANSIT],
    [AT_DELIVERY, PackageStatus.IN_TRANSIT],
    [AT_FEDEX_FACILITY, PackageStatus.IN_TRANSIT],
    [AT_PICKUP, PackageStatus.IN_TRANSIT],
    [ARRIVED_AT, PackageStatus.IN_TRANSIT],
    [AT_USPS_FACILITY, PackageStatus.IN_TRANSIT],
    [LOCATION_CHANGED, PackageStatus.IN_TRANSIT],
    [DELIVERY_DELAY, PackageStatus.IN_TRANSIT],
    [DEPARTED, PackageStatus.IN_TRANSIT],
    [VEHICLE_FURNISHED_BUT_NOT_USED, PackageStatus.IN_TRANSIT],
    [VEHICLE_DISPATCHED, PackageStatus.IN_TRANSIT],
    [DELAY, PackageStatus.IN_TRANSIT],
    [ENROUTE_TO_AIRPORT, PackageStatus.IN_TRANSIT],
    [ENROUTE_TO_DELIVERY, PackageStatus.IN_TRANSIT],
    [ENROUTE_TO_ORIGIN_AIRPORT, PackageStatus.IN_TRANSIT],
    [ENROUTE_TO_PICKUP, PackageStatus.IN_TRANSIT],
    [AT_FEDEX_DESTINATION, PackageStatus.IN_TRANSIT],
    [HOLD_AT_LOCATION, PackageStatus.IN_TRANSIT],
    [IN_TRANSIT, PackageStatus.IN_TRANSIT],
    [IN_TRANSIT_SEE_DETAILS, PackageStatus.IN_TRANSIT],
    [LEFT_ORIGIN, PackageStatus.IN_TRANSIT],
    [PLANE_IN_FLIGHT, PackageStatus.IN_TRANSIT],
    [PLANE_LANDED, PackageStatus.IN_TRANSIT],
    [IN_PROGRESS, PackageStatus.IN_TRANSIT],
    [CDO_REQUESTED, PackageStatus.IN_TRANSIT],
    [CDO_MODIFIED, PackageStatus.IN_TRANSIT],
    [CDO_CANCELLED, PackageStatus.IN_TRANSIT],
    [AT_SORT_FACILITY, PackageStatus.IN_TRANSIT],
    [SPLIT_STATUS, PackageStatus.IN_TRANSIT],
    [TRANSFER, PackageStatus.IN_TRANSIT],
    [CLEARED_CUSTOMS, PackageStatus.IN_TRANSIT],
    [CLEARANCE_DELAY, PackageStatus.IN_TRANSIT],
    [CLEARANCE_IN_PROGRESS, PackageStatus.IN_TRANSIT],
    [EXPORT_APPROVED, PackageStatus.IN_TRANSIT],
    [RECIPIENT, PackageStatus.IN_TRANSIT],
    [AT_FEDEX_ORIGIN_FACILITY, PackageStatus.IN_TRANSIT],
    [SHIPMENT_INFORMATION_SENT_TO_USPS, PackageStatus.IN_TRANSIT],
    [PICKUP_DELAY, PackageStatus.IN_TRANSIT],
    [SHIPPER, PackageStatus.IN_TRANSIT],
    [CUSTOMS, PackageStatus.IN_TRANSIT],
    [BROKER, PackageStatus.IN_TRANSIT],
    [TRANSFER_PARTNER, PackageStatus.IN_TRANSIT]
]);

module.exports = {
    codes
};
