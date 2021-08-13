const express = require('express');
const jsonwebtoken = require('jsonwebtoken');
const router = express.Router();
const Joi = require('joi');
const validateRequest = require('_middleware/validate-request');
const authorize = require('_middleware/authorize');
const Role = require('_helpers/role');
const accountService = require('./account.service');
const { getToken, getAuthURL } = require('_helpers/googleAuth');

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
router.get('/auth/callback', authCallback, registerSchema, register);
router.get('/packages', authorize(), getPackages);
router.get('/restore-packages', authorize(), restorePackages);
router.get('/reset-packages', authorize(), resetPackages);
router.get('/:id', authorize(), getById);

module.exports = router;

async function authStart(req, res) {
    return res.redirect(getAuthURL(req.query.email));
}

async function authCallback(req, res, next) {
    if (!req.query || !req.query.code) return authStart(req, res);

    const code = req.query.code;
    const emailAddress = JSON.parse(
        decodeURIComponent(req.query.state)
    ).emailAddress;

    const { access_token, refresh_token, id_token, expiry_date } = (
        await getToken(code)
    ).tokens;

    const { email, given_name, family_name } = jsonwebtoken.decode(id_token);

    if (email !== emailAddress) {
        return res.status(400)
            .send(`Error: Authenticated with the wrong account.
      Authenticated with "${email}" instead of "${
            emailAddress ?? 'unknown'
        }".`);
    }

    req.body = {
        ...req.body,
        email,
        firstName: given_name,
        lastName: family_name,
        googleAccessToken: access_token,
        googleRefreshToken: refresh_token,
        googleTokenExpiry: expiry_date
    };

    next();
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

function registerSchema(req, res, next) {
    const schema = Joi.object({
        email: Joi.string().email().required(),
        firstName: Joi.string().required(),
        lastName: Joi.string().required(),
        googleAccessToken: Joi.string().required(),
        googleRefreshToken: Joi.string().required(),
        googleTokenExpiry: Joi.number().required()
    });
    validateRequest(req, next, schema);
}

function register(req, res, next) {
    accountService
        .register(req.body, req.ip, req.get('origin'))
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

function getById(req, res, next) {
    // users can get their own account and admins can get any account
    if (req.params.id !== req.user.id && req.user.role !== Role.Admin) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    accountService
        .getById(req.params.id)
        .then(account => (account ? res.json(account) : res.sendStatus(404)))
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
        senderUrl: Joi.string().required()
    });
    validateRequest(req, next, schema);
}

function addPackage(req, res, next) {
    accountService
        .addPackage(req.query.email, req.body)
        .then(package => res.json({ package }))
        .catch(next);
}
