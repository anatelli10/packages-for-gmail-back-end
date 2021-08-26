const jwt = require('express-jwt');
const db = require('_helpers/db');

module.exports = authorize;

function authorize() {
  return [
    // authenticate JWT token and attach user to request object (req.user)
    jwt({ secret: process.env.SECRET, algorithms: ['HS256'] }),

    async (req, res, next) => {
      const account = await db.Account.findById(req.user.id);
      const refreshTokens = await db.RefreshToken.find({
        account: account.id
      });

      if (!account) return res.status(401).json({ message: 'Account does not exist' });

      req.account = account;
      req.user.ownsToken = (token) => !!refreshTokens.find((x) => x.token === token);
      next();
    }
  ];
}
