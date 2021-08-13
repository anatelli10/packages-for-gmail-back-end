const express = require('express');
const router = express.Router();
const Joi = require('joi');
const validateRequest = require('_middleware/validate-request');
const authorize = require('_middleware/authorize');
const Role = require('_helpers/role');
const accountService = require('./account.service');
const { getAuthURL } = require('_helpers/googleAuth');

router.post('/refresh-token', refreshToken);
router.post('/revoke-token', authorize(), revokeTokenSchema, revokeToken);
router.post('/add-package', authorize(), addPackageSchema, addPackage);
router.post(
    '/delete-packages',
    authorize(),
    deletePackagesSchema,
    deletePackages
);

router.get('/auth/start', authStart);
router.get('/auth/callback', authCallback);
router.get('/packages', authorize(), getPackages);
router.get('/restore-packages', authorize(), restorePackages);
router.get('/reset-packages', authorize(), resetPackages);

module.exports = router;

function authStart(req, res) {
    return res.redirect(getAuthURL(req.query.email));
}

async function authCallback(req, res, next) {
    // Clicked back or cancel in UI
    if (!req.query) return authStart(req, res);

    const emailAddress = JSON.parse(
        decodeURIComponent(req.query.state)
    ).emailAddress;

    accountService
        .authCallback(req.query.code, emailAddress, req.ip, req.get('origin'))
        .then(response =>
            res.send(
                `<script>
                window.parent.opener.postMessage(
                    { loginResponse: ${JSON.stringify(response)} }, 
                    'https://mail.google.com'
                );
            </script>`
            )
        )
        .catch(next);
}

function refreshToken(req, res, next) {
    const token = req.body.refreshToken;
    const ipAddress = req.ip;
    accountService
        .refreshToken({ token, ipAddress })
        .then(response => res.json(response))
        .catch(next);
}

function revokeTokenSchema(req, res, next) {
    const schema = Joi.object({
        token: Joi.string().empty('')
    });
    validateRequest(req, next, schema);
}

function revokeToken(req, res, next) {
    // accept token from request body or cookie
    const token = req.body.token || req.cookies.refreshToken;
    const ipAddress = req.ip;

    if (!token) return res.status(400).json({ message: 'Token is required' });

    // users can revoke their own tokens and admins can revoke any tokens
    if (!req.user.ownsToken(token) && req.user.role !== Role.Admin) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    accountService
        .revokeToken({ token, ipAddress })
        .then(() => res.json({ message: 'Token revoked' }))
        .catch(next);
}

function getPackages(req, res, next) {
    accountService
        .getPackages(req.query.email)
        .then(packages => res.json({ packages }))
        .catch(next);
}

function restorePackages(req, res, next) {
    accountService
        .restorePackages(req.query.email)
        .then(packages => res.json({ packages }))
        .catch(next);
}

function resetPackages(req, res, next) {
    accountService
        .resetPackages(req.query.email)
        .then(packages => res.json({ packages }))
        .catch(next);
}

function deletePackagesSchema(req, res, next) {
    const schema = Joi.array().items(Joi.string());
    validateRequest(req, next, schema);
}

function deletePackages(req, res, next) {
    accountService
        .deletePackages(req.query.email, req.body)
        .then(() => res.json({ message: 'Package(s) deleted' }))
        .catch(next);
}

function addPackageSchema(req, res, next) {
    const schema = Joi.object({
        courierCode: Joi.string().required(),
        trackingNumber: Joi.string().required(),
        sender: Joi.string().required(),
        senderUrl: Joi.string().domain().empty('')
    });
    validateRequest(req, next, schema);
}

function addPackage(req, res, next) {
    accountService
        .addPackage(req.query.email, req.body)
        .then(package => res.json({ package }))
        .catch(next);
}
