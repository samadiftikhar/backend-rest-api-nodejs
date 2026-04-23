const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
    const authHeader = req.get('Authorization');
    if (!authHeader) {
        req.isAuth = false;
        return next();
    }
    const token = req.get('Authorization').split(' ')[1];
    let decodedToken;
    try {
        decodedToken = jwt.verify(token, 'somesupersecretsecret');
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            req.isAuth = false;
            return next();
            // err.statusCode = 401;
            // err.message = 'Token expired';
        } else if (err.name === 'JsonWebTokenError') {
            req.isAuth = false;
            return next();
            // err.statusCode = 401;

            // err.message = 'Invalid token';
        } else {
            req.isAuth = false;
            return next();
        }

        throw err;
    }
    if (!decodedToken) {
        req.isAuth = false;
        return next();
        // const error = new Error('Not authenticated.');
        // error.statusCode = 401;
        // throw error;
    }
    req.userId = decodedToken.userId;
    req.isAuth = true;
    next();

}

